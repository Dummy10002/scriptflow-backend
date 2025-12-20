import { Request, Response } from 'express';
import crypto from 'crypto';
import { scriptGenerationSchema } from '../validators/requestValidator';
import { generateRequestHash } from '../utils/hash';
import { getScriptByHash, saveScript } from '../db/sqlite';
import { downloadReel } from '../services/reelDownloader';
import { extractAudio } from '../services/audioExtractor';
import { transcribeAudio } from '../services/transcription';
import { generateScript } from '../services/scriptGenerator';
import { cleanupFiles } from '../services/cleanup';
import { logger } from '../utils/logger';

export const generateScriptHandler = async (req: Request, res: Response) => {
  let videoPath: string | null = null;
  let audioPath: string | null = null;
  const requestId = crypto.randomUUID();

  try {
    // 1. Validation
    const parseResult = scriptGenerationSchema.safeParse(req.body);
    if (!parseResult.success) {
      logger.warn('Validation failed', parseResult.error);
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_INPUT',
        message: parseResult.error.issues.map(e => e.message).join(', ')
      });
    }

    const { manychat_user_id, reel_url, user_idea } = parseResult.data;

    // 2. Idempotency Check
    const requestHash = generateRequestHash(manychat_user_id, reel_url, user_idea);
    const cachedScript = getScriptByHash(requestHash);

    if (cachedScript) {
      logger.info(`Cache hit: ${requestHash}`);
      return res.json({
        status: 'success',
        script: cachedScript.script_text
      });
    }

    logger.info(`Processing new request: ${requestId}`);

    // 3. Download Reel
    // This is the most likely step to fail or timeout
    videoPath = await downloadReel(reel_url, requestId);

    // 4. Extract Audio
    audioPath = await extractAudio(videoPath, requestId);

    // 5. Transcribe
    const transcript = await transcribeAudio(audioPath);
    logger.info(`Transcription complete (length: ${transcript?.length || 0})`);

    // 6. Generate Script
    const script = await generateScript(user_idea, transcript);

    // 7. Save to DB
    saveScript(requestHash, manychat_user_id, reel_url, user_idea, script);

    // 8. Respond
    return res.json({
      status: 'success',
      script
    });

  } catch (error: any) {
    logger.error(`Request ${requestId} failed`, error);
    
    const statusCode = error.message === 'Video too long' ? 400 : 500;
    const errorCode = error.message === 'Video too long' ? 'VIDEO_TOO_LONG' : 'PROCESSING_FAILED';
    
    if (!res.headersSent) {
      return res.status(statusCode).json({
        status: 'error',
        code: errorCode,
        message: error.message || 'Unable to process this reel'
      });
    }
  } finally {
    // 9. Cleanup
    cleanupFiles([videoPath, audioPath]);
  }
};
