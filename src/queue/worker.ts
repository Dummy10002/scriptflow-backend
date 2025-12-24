import { Worker, Job } from 'bullmq';
import { config } from '../config';
import { logger } from '../utils/logger';
import { downloadReel } from '../services/reelDownloader';

import { generateScript } from '../services/scriptGenerator';
import { cleanupFiles } from '../services/cleanup';
import { sendToManyChat } from '../services/manychat';
import { generateScriptImage } from '../utils/imageGenerator';
import { Script } from '../models/Script';
import crypto from 'crypto';

interface ScriptJobData {
  requestId: string;
  requestHash: string;
  userId: string;
  url: string;
  idea: string;
}

const workerHandler = async (job: Job<ScriptJobData>) => {
  const { requestId, requestHash, userId, url, idea } = job.data;
  
  logger.info(`[${requestId}] Worker started processing job ${job.id}`);
  let videoPath: string | null = null;
  let audioPath: string | null = null;

  try {
    // A. Download
    videoPath = await downloadReel(url, requestId);
    
    // B. Analyze & Generate (Vision Mode)
    logger.info(`[${requestId}] Video downloaded at ${videoPath}. Sending to Gemini Vision...`);
    const { script: scriptText, visualAnalysis } = await generateScript(idea, videoPath, userId);

    // C. Save to MongoDB (Optimized Schema)
    await Script.create({
      originalInput: {
        reelUrl: url,
        userIdea: idea
      },
      aiGeneration: {
        promptUsed: `Generate a script for: ${idea}. [Video Analysis Mode]`, // Log that vision was used
        modelUsed: 'gemini-2.5-flash-lite',
        visualAnalysis: visualAnalysis,
        rawOutput: scriptText
      },
      finalOutput: {
        scriptText: scriptText
      },
      meta: {
        manychatUserId: userId,
        requestHash: requestHash,
        ipAddress: 'worker'
      }
    });

    // F. Send to ManyChat
    logger.info(`[${requestId}] Generated script. Generating image...`);
    const imageUrl = await generateScriptImage(scriptText);

    await sendToManyChat({
      subscriber_id: userId,
      field_value: imageUrl
    });

    logger.info(`[${requestId}] Job completed successfully`);

  } catch (error: any) {
    logger.error(`[${requestId}] Worker failed`, error);
    if (error.response && error.response.data) {
        console.log('ManyChat Error Details:', JSON.stringify(error.response.data, null, 2));
    }
    throw error; // Rethrow to mark job as failed in BullMQ
  } finally {
    // Cleanup
    cleanupFiles([videoPath]);
  }
};

// Initialize Worker
// We export a function to start it, or we can just start it if this file is the entry point.
// For flexibility, we export a setup function.

export const setupWorker = () => {
  const worker = new Worker('script-generation', workerHandler, {
    connection: {
      url: config.REDIS_URL
    },
    concurrency: 2 // Limit to 2 concurrent jobs per worker instance
  });

  worker.on('completed', job => {
    logger.info(`Job ${job.id} completed!`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed with ${err.message}`);
  });

  logger.info('Worker listening for jobs...');
  return worker;
};
