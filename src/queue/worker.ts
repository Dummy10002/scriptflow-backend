import { Worker, Job as BullJob } from 'bullmq';
import path from 'path';
import { getRedis } from './redis';
import { ScriptJobData, ScriptJobResult, QUEUE_NAME } from './scriptQueue';
import { logger } from '../utils/logger';

// Services
import { downloadReel } from '../services/reelDownloader';
import { extractAudio } from '../services/audioExtractor';
import { extractFrames, cleanupFrames } from '../services/frameExtractor';
import { analyzeVideo, VideoAnalysis } from '../services/videoAnalyzer';
import { generateScript } from '../services/scriptGenerator';
import { cleanupFiles } from '../services/cleanup';
import { sendToManyChat } from '../services/manychat';
import { generateScriptImage } from '../utils/imageGenerator';

// Database
import { Script, Job, DatasetEntry } from '../db/models';

// Analysis mode configuration
type AnalysisMode = 'audio' | 'frames' | 'hybrid';
const ANALYSIS_MODE: AnalysisMode = (process.env.ANALYSIS_MODE as AnalysisMode) || 'hybrid';

let worker: Worker<ScriptJobData, ScriptJobResult> | null = null;

/**
 * Process a script generation job
 * This is the main worker function that handles all the heavy lifting
 */
async function processJob(job: BullJob<ScriptJobData>): Promise<ScriptJobResult> {
  const { requestId, requestHash, subscriberId, reelUrl, userIdea } = job.data;
  
  logger.info(`[${requestId}] Starting job processing (attempt ${job.attemptsMade + 1})`);
  
  // Update job status in MongoDB
  await Job.findOneAndUpdate(
    { jobId: requestId },
    { 
      status: 'processing',
      startedAt: new Date(),
      attempts: job.attemptsMade + 1
    }
  );

  let videoPath: string | null = null;
  let audioPath: string | null = null;
  let frameDir: string | null = null;
  const startTime = Date.now();

  try {
    // Report progress
    await job.updateProgress(10);

    // A. Download video
    logger.info(`[${requestId}] Downloading video...`);
    videoPath = await downloadReel(reelUrl, requestId);
    await job.updateProgress(25);

    // B. Extract media based on analysis mode
    let videoAnalysis: VideoAnalysis | null = null;
    let transcript: string | null = null;

    if (ANALYSIS_MODE === 'hybrid' || ANALYSIS_MODE === 'frames') {
      logger.info(`[${requestId}] Extracting frames & audio...`);
      
      const framePromise = extractFrames(videoPath, requestId, {
        quality: 5,
        width: 480
      });

      let audioPromise: Promise<string | null> | null = null;
      if (ANALYSIS_MODE === 'hybrid') {
        audioPromise = extractAudio(videoPath, requestId);
      }

      // Parallel execution (Optimization: Save ~2-3s)
      const [frameResult, audioResult] = await Promise.all([
        framePromise,
        audioPromise ? audioPromise : Promise.resolve(null)
      ]);

      const { frames, extractionTimeMs } = frameResult;
      audioPath = audioResult;
      
      logger.info(`[${requestId}] Frames extracted in ${extractionTimeMs}ms`);
      if (audioPath) logger.info(`[${requestId}] Audio extracted`);
      
      await job.updateProgress(40);

      if (frames.length > 0) {
        frameDir = path.dirname(frames[0]);

        logger.info(`[${requestId}] Analyzing video with ${frames.length} frames...`);
        videoAnalysis = await analyzeVideo({
          frames,
          audioPath: audioPath || undefined,
          includeAudio: !!audioPath
        });

        transcript = videoAnalysis.transcript;
        await job.updateProgress(60);
      } else {
        logger.warn(`[${requestId}] Frame extraction failed, falling back to audio-only`);
        if (!audioPath) {
           // If we didn't extract audio yet (e.g. somehow failed parallel), try strictly now
           audioPath = await extractAudio(videoPath, requestId);
        }
        videoAnalysis = await analyzeVideo({ audioPath, includeAudio: true });
        transcript = videoAnalysis.transcript;
        await job.updateProgress(60);
      }
    } else {
      audioPath = await extractAudio(videoPath, requestId);
      videoAnalysis = await analyzeVideo({ audioPath, includeAudio: true });
      transcript = videoAnalysis.transcript;
      await job.updateProgress(60);
    }

    // C. Generate script
    logger.info(`[${requestId}] Generating script...`);
    const scriptText = await generateScript({
      userIdea,
      transcript,
      visualAnalysis: videoAnalysis
    });
    await job.updateProgress(75);

    const generationTimeMs = Date.now() - startTime;

    // D. Generate script image FIRST (so we can cache the URL)
    logger.info(`[${requestId}] Generating script image...`);
    const imageUrl = await generateScriptImage(scriptText);
    await job.updateProgress(80);

    // E. Save to MongoDB (Script collection) - including imageUrl
    await Script.findOneAndUpdate(
      { requestHash },
      {
        requestHash,
        manychatUserId: subscriberId,
        reelUrl,
        userIdea,
        scriptText,
        imageUrl,           // Now included!
        generationTimeMs,
        modelVersion: 'gemini-2.5-flash'
      },
      { upsert: true, new: true }
    );

    // E. Save to Dataset for ML training
    await DatasetEntry.create({
      input: {
        videoUrl: reelUrl,
        userIdea,
        transcript: transcript || undefined,
        visualCues: videoAnalysis?.visualCues || [],
        hookType: videoAnalysis?.hookType,
        tone: videoAnalysis?.tone,
        frameCount: videoAnalysis?.sceneDescriptions.length
      },
      output: {
        generatedScript: scriptText,
        scriptLengthChars: scriptText.length
      },
      metrics: {
        generationTimeMs
      },
      modelVersion: 'gemini-2.5-flash',
      datasetVersion: '1.0.0'
    });
    await job.updateProgress(90);

    // G. Send to ManyChat
    await sendToManyChat({
      subscriber_id: subscriberId,
      field_name: 'script_image_url',
      field_value: imageUrl
    });

    // G. Update job status
    await Job.findOneAndUpdate(
      { jobId: requestId },
      {
        status: 'completed',
        completedAt: new Date(),
        processingTimeMs: Date.now() - startTime,
        result: { scriptText, imageUrl }
      }
    );

    logger.info(`[${requestId}] Job completed successfully in ${Date.now() - startTime}ms`);
    await job.updateProgress(100);

    return {
      success: true,
      scriptText,
      imageUrl
    };

  } catch (error: any) {
    logger.error(`[${requestId}] Job failed:`, error);

    // Update job status to failed
    await Job.findOneAndUpdate(
      { jobId: requestId },
      {
        status: 'failed',
        error: error.message,
        errorStack: error.stack,
        completedAt: new Date()
      }
    );

    // Send fallback script on final attempt
    if (job.attemptsMade >= 2) {
      const fallbackScript = `I couldn't watch that specific reel, but here is a script based on your idea:
      
[HOOK]
(Start with a strong statement about ${userIdea})

[BODY]
(Explain your main point about ${userIdea})

[CTA]
(Tell them to comment or follow)`;

      try {
        await sendToManyChat({
          subscriber_id: subscriberId,
          field_name: 'AI_Script_Result',
          field_value: fallbackScript
        });
      } catch (manyChatError) {
        logger.error(`[${requestId}] Failed to send fallback:`, manyChatError);
      }
    }

    throw error; // Re-throw to trigger BullMQ retry

  } finally {
    // Cleanup files
    cleanupFiles([videoPath, audioPath]);
    if (frameDir) {
      cleanupFrames(frameDir);
    }
  }
}

/**
 * Start the BullMQ worker
 * 
 * Concurrency is set to handle multiple jobs simultaneously
 * This is key for handling 100 concurrent users
 */
export function startWorker(): Worker<ScriptJobData, ScriptJobResult> {
  const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '5', 10);
  
  worker = new Worker<ScriptJobData, ScriptJobResult>(QUEUE_NAME, processJob, {
    connection: getRedis(),
    concurrency,
    limiter: {
      max: 10,        // Max 10 jobs
      duration: 60000 // Per minute (prevent API rate limits)
    }
  });

  worker.on('ready', () => {
    logger.info(`✅ BullMQ Worker ready (concurrency: ${concurrency})`);
  });

  worker.on('active', (job) => {
    logger.info(`Worker: Job ${job.id} started processing`);
  });

  worker.on('progress', (job, progress) => {
    logger.info(`Worker: Job ${job.id} progress: ${progress}%`);
  });

  worker.on('completed', (job) => {
    logger.info(`Worker: Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    logger.error(`Worker: Job ${job?.id} failed:`, error.message);
    logger.error(`Worker: Full error:`, error);
  });

  worker.on('error', (error) => {
    logger.error('Worker error:', error);
  });

  logger.info(`Worker created for queue: ${QUEUE_NAME}`);
  return worker;
}

/**
 * Stop the worker gracefully
 */
export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info('BullMQ Worker stopped');
  }
}

export { worker };
