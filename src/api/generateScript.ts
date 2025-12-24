import { Request, Response } from 'express';
import crypto from 'crypto';
import { scriptGenerationSchema } from '../validators/requestValidator';
import { generateRequestHash } from '../utils/hash';
import { Script } from '../models/Script'; // Use Mongoose model
import { logger } from '../utils/logger';
import { scriptQueue } from '../queue/producer';

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

  const { subscriber_id, reel_url, user_idea } = parseResult.data;
  const requestHash = generateRequestHash(subscriber_id, reel_url, user_idea);

  // 2. Idempotency Check (Fast Path from MongoDB)
  try {
    const cachedScript = await Script.findOne({ 'meta.requestHash': requestHash });
    
    if (cachedScript) {
      logger.info(`Cache hit: ${requestHash}. INVALIDATING CACHE for testing purposes.`);
      // FORCE REGENERATION: Delete the old record so we can run the flow again and deliver the message
      await Script.deleteOne({ _id: cachedScript._id });
      // Proceed to queue...
      // return res.json(...) // DISABLED
    }
  } catch (err) {
    logger.error('Error checking cache', err);
    // Continue even if cache check fails? safer to continue
  }

  // 3. Add to Queue
  try {
    await scriptQueue.add('generate-script', {
      requestId,
      requestHash,
      userId: subscriber_id,
      url: reel_url,
      idea: user_idea
    });

    logger.info(`[${requestId}] Job added to queue`);

    // 4. Immediate Response
    res.json({
      status: 'queued',
      message: 'Analyzing your reel... I will send the script in a new message shortly!'
    });
  } catch (error) {
    logger.error('Failed to add job to queue', error);
    res.status(500).json({
      status: 'error',
      code: 'QUEUE_ERROR',
      message: 'Failed to queue request'
    });
  }
};
