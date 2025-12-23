import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

export const authenticateKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== config.API_SECRET_KEY) {
    logger.warn(`Unauthorized access attempt from IP: ${req.ip}`);
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Invalid or missing API Key'
    });
  }

  next();
};
