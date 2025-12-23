import { Worker, Job } from 'bullmq';
import { config } from '../config';
import { logger } from '../utils/logger';
import { downloadReel } from '../services/reelDownloader';
import { extractAudio } from '../services/audioExtractor';
import { transcribeAudio } from '../services/transcription';
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
    
    // B. Extract
    audioPath = await extractAudio(videoPath, requestId);

    // C. Transcribe
    const transcript = await transcribeAudio(audioPath);
    logger.info(`[${requestId}] Transcription length: ${transcript?.length || 0}`);

    // D. Generate
    const scriptText = await generateScript(idea, transcript);

    // E. Save to MongoDB (Optimized Schema)
    // Create new Script record
    await Script.create({
      originalInput: {
        reelUrl: url,
        userIdea: idea
      },
      aiGeneration: {
        promptUsed: `Generate a script for: ${idea}. Transcript: ${transcript?.substring(0, 100)}...`, // Approximate prompt log
        modelUsed: 'gemini-1.5-flash',
        rawOutput: scriptText
      },
      finalOutput: {
        scriptText: scriptText
      },
      meta: {
        manychatUserId: userId,
        requestHash: requestHash,
        ipAddress: 'worker' // IP not available in worker context easily, or pass from job data
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
    cleanupFiles([videoPath, audioPath]);
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
