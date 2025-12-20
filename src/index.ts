import 'dotenv/config';
import { createServer } from './server';
import { initDB } from './db/sqlite';
import { logger } from './utils/logger';
import fs from 'fs';
import path from 'path';

// Ensure temp directory exists
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Initialize Database
initDB();

// Debug: List available models
import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
async function listModels() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
    // Accessing model list is distinct, but let's try to just hit a dummy prompt on "gemini-pro" first to check connectivity
    // actually, the SDK has a specific manager for this usually, but it's simpler to just try generating on a known safe model.
    console.log("Checking API Key validity...");
  } catch (e) {
    console.error("Model check error", e);
  }
}
listModels();

const app = createServer();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
