import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { generateScriptHandler } from './api/generateScript';
import { logger } from './utils/logger';

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Global Timeout Middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Set timeout to 10 seconds
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timed out at global middleware');
        res.status(503).json({
          status: 'error',
          code: 'TIMEOUT',
          message: 'Request processing exceeded 10 seconds'
        });
      }
    }, 10000);

    // Clear timeout if response finishes
    res.on('finish', () => clearTimeout(timeout));
    next();
  });

  // Routes
  app.post('/api/v1/script/generate', generateScriptHandler);

  // Health Check
  app.get('/health', (req, res) => res.send('OK'));

  // 404 Handler - Must be after routes but before error handler
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(404).json({
      status: 'error',
      code: 'NOT_FOUND',
      message: `Endpoint not found: ${req.method} ${req.originalUrl}`
    });
  });

  // Central Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled server error', err);
    if (!res.headersSent) {
      res.status(500).json({
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      });
    }
  });

  return app;
}
