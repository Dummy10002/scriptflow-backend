import { Queue } from 'bullmq';
import { config } from '../config';
import { logger } from '../utils/logger';

// Create a new Queue instance
// Note: connection options must be parsed if REDIS_URL includes auth/etc if IoRedis needs it, 
// but BullMQ + IoRedis usually handles the connection string well if provided as connection object.
// We'll use a simple connection object.

export const scriptQueue = new Queue('script-generation', {
  connection: {
    url: config.REDIS_URL
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 200      // Keep last 200 failed jobs for debugging
  },
});

logger.info('Script Generation Queue initialized');
