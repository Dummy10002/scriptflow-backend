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
import { generateUniquePublicId, buildScriptUrl } from '../api/viewScript';
import { generateReelHash, normalizeInstagramUrl } from '../utils/hash';

// Database
import { Script, Job, ReelDNA } from '../db/models';
import { 
  DatasetEntry, 
  parseScriptSections, 
  extractVisualLines, 
  extractDialogueLines, 
  estimateSpokenDuration,
  countWords
} from '../db/models/Dataset';

// Analysis mode configuration
type AnalysisMode = 'audio' | 'frames' | 'hybrid';
const ANALYSIS_MODE: AnalysisMode = (process.env.ANALYSIS_MODE as AnalysisMode) || 'hybrid';

let worker: Worker<ScriptJobData, ScriptJobResult> | null = null;

/**
 * Process a script generation job
 * This is the main worker function that handles all the heavy lifting
 */
async function processJob(job: BullJob<ScriptJobData>): Promise<ScriptJobResult> {
  const { 
    requestId, 
    requestHash, 
    subscriberId, 
    reelUrl, 
    userIdea,
    // NEW: Optional hints
    toneHint,
    languageHint,
    mode 
  } = job.data;
  
  logger.info(`[${requestId}] Starting job processing (attempt ${job.attemptsMade + 1})${toneHint ? ` [tone: ${toneHint}]` : ''}${mode === 'hook_only' ? ' [hook only]' : ''}`);
  
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

    // ==== TIER 1 CACHE CHECK: Reuse video analysis if available ====
    const reelHash = generateReelHash(reelUrl);
    const cachedDNA = await ReelDNA.findOne({ reelUrlHash: reelHash }).lean();
    
    let videoAnalysis: VideoAnalysis | null = null;
    let transcript: string | null = null;
    let frames: string[] = [];
    let usedTier1Cache = false;

    if (cachedDNA) {
      // TIER 1 CACHE HIT: Skip download/extraction/analysis entirely!
      logger.info(`[${requestId}] ✅ Tier 1 Cache HIT (Reel DNA found) - Skipping video processing`);
      videoAnalysis = cachedDNA.analysis;
      transcript = videoAnalysis.transcript;
      usedTier1Cache = true;
      await job.updateProgress(60); // Jump ahead since we skipped expensive steps
    } else {
      // TIER 1 CACHE MISS: Full video processing required
      logger.info(`[${requestId}] Tier 1 Cache MISS - Processing video...`);

      // A. Download video
      logger.info(`[${requestId}] Downloading video...`);
      videoPath = await downloadReel(reelUrl, requestId);
      await job.updateProgress(25);

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

      const { frames: extractedFrames, extractionTimeMs } = frameResult;
      frames = extractedFrames;  // Assign to outer scope
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
      // Audio-only mode
      audioPath = await extractAudio(videoPath, requestId);
      videoAnalysis = await analyzeVideo({ audioPath, includeAudio: true });
      transcript = videoAnalysis.transcript;
      await job.updateProgress(60);
    }

      // ==== STORE TIER 1 CACHE: Save analysis for future requests ====
      if (videoAnalysis) {
        try {
          await ReelDNA.create({
            reelUrlHash: reelHash,
            reelUrl,
            analysis: videoAnalysis
          });
          logger.info(`[${requestId}] ✅ Tier 1 Cache saved (Reel DNA stored)`);
        } catch (cacheError: any) {
          // Ignore duplicate key errors (race condition with parallel requests)
          if (cacheError.code !== 11000) {
            logger.warn(`[${requestId}] Failed to save Tier 1 cache:`, cacheError.message);
          }
        }
      }
    } // End of Tier 1 cache miss block

    // C. Lookup previous scripts for this reel (Expert: learn from history)
    let previousScripts: { idea: string; script: string }[] = [];
    try {
      const normalizedUrl = normalizeInstagramUrl(reelUrl);
      
      // Expert Lookup: Find scripts sharing the same normalized URL
      const previousScriptsRaw = await Script.find({ 
        reelUrl: normalizedUrl 
      })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();
      
      previousScripts = previousScriptsRaw
        .filter(ps => ps.userIdea !== userIdea) // Don't include same idea
        .map(ps => ({ idea: ps.userIdea, script: ps.scriptText }));
      
      if (previousScripts.length > 0) {
        logger.info(`[${requestId}] Found ${previousScripts.length} previous scripts for context learning`);
      }
    } catch (contextError: any) {
      // Expert Error Handling: Don't fail generation just because history lookup failed
      logger.warn(`[${requestId}] Non-critical: Failed to lookup previous scripts: ${contextError.message}`);
    }

    // D. Generate script (with optional hints and previous scripts)

    logger.info(`[${requestId}] Generating script...`);
    const scriptGenStartTime = Date.now();
    const scriptText = await generateScript({
      userIdea,
      transcript,
      visualAnalysis: videoAnalysis,
      toneHint,
      languageHint,
      mode,
      previousScripts // NEW: Pass previous scripts for learning
    });
    const scriptGenTimeMs = Date.now() - scriptGenStartTime;
    await job.updateProgress(75);

    const generationTimeMs = Date.now() - startTime;

    // D. Generate script image FIRST (so we can cache the URL)
    logger.info(`[${requestId}] Generating script image...`);
    const imageUrl = await generateScriptImage(scriptText);
    await job.updateProgress(80);

    // D2. Generate public ID for copy-friendly link (collision-safe)
    const publicId = await generateUniquePublicId();
    const scriptUrl = buildScriptUrl(publicId);
    logger.info(`[${requestId}] Script URL: ${scriptUrl}`);

    // E. Save to MongoDB (Script collection) - including imageUrl and scriptUrl
    await Script.findOneAndUpdate(
      { requestHash },
      {
        requestHash,
        publicId,
        manychatUserId: subscriberId,
        reelUrl,
        userIdea,
        scriptText,
        imageUrl,
        scriptUrl,
        generationTimeMs,
        modelVersion: 'gemini-2.5-flash'
      },
      { upsert: true, new: true }
    );

    // E. Save to Dataset for ML training (Enhanced schema v2.0)
    const scriptSections = parseScriptSections(scriptText);
    const analysisTimeMs = generationTimeMs - scriptGenTimeMs;
    
    await DatasetEntry.create({
      // INPUT FEATURES
      input: {
        videoUrl: reelUrl,
        userIdea,
        requestHash,
        
        // User preferences (hints)
        toneHint,
        languageHint,
        mode: mode || 'full',
        
        // Video analysis results
        transcript: transcript || undefined,
        transcriptWordCount: countWords(transcript || undefined),
        visualCues: videoAnalysis?.visualCues || [],
        hookType: videoAnalysis?.hookType,
        detectedTone: videoAnalysis?.tone,
        sceneDescriptions: videoAnalysis?.sceneDescriptions || [],
        frameCount: frames?.length || 0
      },
      
      // OUTPUT FEATURES
      output: {
        generatedScript: scriptText,
        scriptSections,
        visualDirections: extractVisualLines(scriptText),
        dialogueLines: extractDialogueLines(scriptText),
        scriptLengthChars: scriptText.length,
        estimatedSpokenDuration: estimateSpokenDuration(scriptText),
        hookLengthChars: scriptSections.hook?.length || 0,
        bodyLengthChars: scriptSections.body?.length || 0,
        ctaLengthChars: scriptSections.cta?.length || 0
      },
      
      // FEEDBACK (defaults, updated later via feedback API)
      feedback: {
        wasAccepted: true,
        sectionFeedback: {
          hook: { wasRegenerated: false },
          body: { wasRegenerated: false },
          cta: { wasRegenerated: false }
        }
      },
      
      // GENERATION METADATA
      generation: {
        analysisModel: 'gemini-2.5-flash',
        scriptModel: 'gemini-2.5-flash',
        analysisTimeMs,
        generationTimeMs: scriptGenTimeMs,
        totalTimeMs: generationTimeMs,
        analysisAttempts: 1,
        generationAttempts: 1,
        promptVersion: 'steal-artist-v2.0'
      },
      
      // TRAINING FLAGS
      training: {
        isValidated: false,
        qualityScore: 50, // Default, recomputed on feedback
        includedInTraining: false,
        datasetVersion: '2.0.0',
        schemaVersion: '2.0.0'
      }
    });
    await job.updateProgress(90);

    // G. Send to ManyChat (with copy-friendly link)
    await sendToManyChat({
      subscriber_id: subscriberId,
      field_name: 'script_image_url',
      field_value: imageUrl,
      scriptUrl  // NEW: Include copy-friendly URL
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
    // SECURITY: Don't store full stack traces in production (exposes internal paths)
    await Job.findOneAndUpdate(
      { jobId: requestId },
      {
        status: 'failed',
        error: error.message,
        errorStack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
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
