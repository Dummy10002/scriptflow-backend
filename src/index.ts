// import 'dotenv/config'; // Validation moved to config.ts
import { createServer } from './server';
import { connectDB } from './db/mongo';
import { logger } from './utils/logger';
import fs from 'fs';
import path from 'path';

// Ensure temp directory exists
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Initialize Database
import { config } from './config';

// ... (imports)

// Initialize Database
connectDB();

// Initialize Worker (for single-instance deployment)
// In a scaled environment, this would run in a separate process
import { setupWorker } from './queue/worker';
setupWorker();

const app = createServer();
const PORT = config.PORT;

const server = app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
  logger.info(`Environment: ${config.NODE_ENV}`);
});

// Graceful Shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  
  server.close(() => {
    logger.info('HTTP server closed.');
  });

  try {
    // Close Puppeteer
    const { closeBrowser } = await import('./services/browser');
    await closeBrowser();
    logger.info('Browser service closed.');
    
    process.exit(0);
  } catch (err) {
    logger.error(`Error during shutdown: ${err}`);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
