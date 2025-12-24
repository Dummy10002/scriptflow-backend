import { Request, Response, NextFunction } from 'express';
import { RateLimit } from '../models/RateLimit';
import { logger } from '../utils/logger';

// Configuration
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get IP - simplified for this environment
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    
    // Find existing record
    let record = await RateLimit.findOne({ ip });

    const now = new Date();

    if (!record) {
      // Create new record
      record = await RateLimit.create({
        ip,
        count: 1,
        windowStart: now,
        createdAt: now
      });
      return next();
    }

    // Check if window has expired
    const timePassed = now.getTime() - record.windowStart.getTime();
    
    if (timePassed > WINDOW_MS) {
      // Reset window
      record.count = 1;
      record.windowStart = now;
      record.createdAt = now; // Update this to refresh TTL if needed
      await record.save();
      return next();
    }

    // Check limit
    if (record.count >= MAX_REQUESTS) {
      logger.warn(`Rate limit exceeded for IP: ${ip}`);
      return res.status(429).json({
        status: 'error',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.'
      });
    }

    // Increment count
    record.count += 1;
    await record.save();
    
    next();
  } catch (error) {
    logger.error('Rate limiting error:', error);
    // Fail open (allow request) if simple error, or block? 
    // Safer to allow if DB fails so we don't block everyone during an outage?
    // But for security, maybe block? Use judgment: Fail open for UX.
    next(); 
  }
};
