import { Request, Response } from 'express';
import crypto from 'crypto';
import pLimit from 'p-limit';
import { scriptGenerationSchema } from '../validators/requestValidator';
import { generateRequestHash } from '../utils/hash';
import { getScriptByHash, saveScript } from '../db/sqlite';
import { logger } from '../utils/logger';

// Services
import { downloadReel } from '../services/reelDownloader';
import { extractAudio } from '../services/audioExtractor';
import { transcribeAudio } from '../services/transcription';
import { generateScript } from '../services/scriptGenerator';
import { cleanupFiles } from '../services/cleanup';
import { sendToManyChat } from '../services/manychat';
import { generateScriptImage } from '../utils/imageGenerator';

/**
 * ASYNC HANDLER (Option B)
 * Returns immediate response to ManyChat to prevent timeout.
 * Processes video in background and sends result via ManyChat API.
 */
export const generateScriptHandler = async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();

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
  const requestHash = generateRequestHash(manychat_user_id, reel_url, user_idea);

  // 2. Idempotency Check (Fast Path)
  const cachedScript = getScriptByHash(requestHash);
  if (cachedScript) {
    logger.info(`Cache hit: ${requestHash}`);
    // If cached, we can return it immediately or send it async. 
    // For consistency with the Flow, let's return it immediately IF it's fast enough, 
    // but the contract is now "I'll get back to you".
    // Actually, if we have it, just return it. ManyChat can handle a fast JSON response.
    return res.json({
      script: cachedScript.script_text
    });
  }

  // 3. Immediate Response (prevent timeout)
  // We return a "Processing" signal. ManyChat should be configured to ignore this JSON 
  // or mapped to a standard "We are working on it" message.
  res.json({
    status: 'queued',
    message: 'Analyzing your reel... I will send the script in a new message shortly!'
  });

 // 4. Background Processing
  // Use p-limit to restrict concurrency
  limit(() => processAsyncScript(requestId, requestHash, manychat_user_id, reel_url, user_idea));
};

// ... existing code ...

const limit = pLimit(2); // Limit to 2 concurrent jobs to prevent OOM

// Background Worker
async function processAsyncScript(
  requestId: string, 
  requestHash: string,
  userId: string, 
  url: string, 
  idea: string
) {
  logger.info(`[${requestId}] Starting background analysis`);
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
    if (transcript) {
        logger.info(`[${requestId}] Transcription text: ${transcript}`);
    }

    // D. Generate
    const script = await generateScript(idea, transcript);

    // E. Save
    saveScript(requestHash, userId, url, idea, script);

    // F. Send to ManyChat
    logger.info(`[${requestId}] Generated script: ${script}`);
    
    // Convert to Image
    logger.info(`[${requestId}] Generating image from script...`);
    const imageUrl = await generateScriptImage(script);

    // Send Image URL to ManyChat
    await sendToManyChat({
      subscriber_id: userId,
      field_name: 'script_image_url', // Changed from text field to image URL field
      field_value: imageUrl
    });

  } catch (error: any) {
    logger.error(`[${requestId}] Background processing failed`, error);
    if (error.response && error.response.data) {
        console.log('ManyChat Error Details:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Fallback? Yes, send a fallback script via ManyChat API
    const fallbackScript = `I couldn't watch that specific reel, but here is a script based on your idea:
    
HOOK
(Start with a strong statement about ${idea})

BODY
(Explain your main point about ${idea})

CTA
(Tell them to comment or follow)`;

    await sendToManyChat({
      subscriber_id: userId,
      field_name: 'AI_Script_Result',
      field_value: fallbackScript
    });

  } finally {
    // Cleanup
    cleanupFiles([videoPath, audioPath]);
  }
}
