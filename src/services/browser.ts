import puppeteer, { Browser } from 'puppeteer';
import { logger } from '../utils/logger';
import { config } from '../config';

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browserInstance) {
    return browserInstance;
  }

  logger.info('Launching new Puppeteer browser instance...');

  const executablePath = config.PUPPETEER_EXECUTABLE_PATH || undefined;

  browserInstance = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  browserInstance.on('disconnected', () => {
    logger.warn('Puppeteer browser disconnected. Clearing instance.');
    browserInstance = null;
  });

  return browserInstance;
}

export async function closeBrowser() {
  if (browserInstance) {
    logger.info('Closing Puppeteer browser instance...');
    await browserInstance.close();
    browserInstance = null;
  }
}
