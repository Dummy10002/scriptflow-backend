import { Request, Response } from 'express';
import crypto from 'crypto';
import { scriptGenerationSchema } from '../validators/requestValidator';
import { generateRequestHash } from '../utils/hash';
import { getScriptByHash, saveScript } from '../db/sqlite';
import { generateScript } from '../services/scriptGenerator';
import { logger } from '../utils/logger';

export const generateScriptHandler = async (req: Request, res: Response) => {
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
        script: cachedScript.script_text
      });
    }

    logger.info(`Processing new request: ${requestId}`);

    // 3. AI Script Generation (Synchronous Path)
    // We treat reel_url as context only, skipping download/transcription
    let script: string;
    try {
        // Enforce 8s timeout as per PRD Section 10
        const timeoutPromise = new Promise<string>((_, reject) => {
            setTimeout(() => reject(new Error('AI_TIMEOUT')), 8000);
        });

        script = await Promise.race([
            generateScript(user_idea),
            timeoutPromise
        ]);
    } catch (error) {
        logger.error(`AI generation failed for ${requestId} (Error: ${error instanceof Error ? error.message : error}), returning fallback`);
        script = `I couldn’t fully analyze the reel, but here’s a script you can use based on your idea:

HOOK
(Start with a strong statement about ${user_idea})

BODY
(Explain your main point about ${user_idea})

CTA
(Tell them to comment or follow)`;
    }

    // 4. Save to DB
    // We save even fallbacks to respect idempotency for this input combo
    saveScript(requestHash, manychat_user_id, reel_url, user_idea, script);

    // 5. Respond
    // Strict contract: { script: "..." }
    return res.json({
      script
    });

  } catch (error: any) {
    // This catch block handles unexpected errors outside of AI generation (e.g. DB errors)
    // Even here, we try to return a valid JSON script response if possible, 
    // but if it's a structural error (like DB failure), we might default to a safe fail.
    // PRD says "Almost never fail".
    logger.error(`Critical request failure ${requestId}`, error);
    
    // Last resort fallback
    return res.json({
        script: "I'm having trouble connecting right now, but please try recording your idea directly!"
    });
  }
};
