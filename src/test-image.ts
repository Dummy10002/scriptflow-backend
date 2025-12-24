import * as dotenv from 'dotenv';
dotenv.config();

// Mock missing env vars for test if they are not present
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';
process.env.API_SECRET_KEY = process.env.API_SECRET_KEY || 'testsecret';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'dummy'; // Should be real
process.env.IMGBB_API_KEY = process.env.IMGBB_API_KEY || 'dummy'; // Should be real

import { generateScriptImage } from './utils/imageGenerator';

async function runTest() {
  console.log("Starting Image Generation Test (Satori)...");
  
  const sampleScript = `
  [HOOK]
  Stop scrolling right now.
  
  [BODY]
  Most people fail at marketing because they are boring. 
  The secret is to use the "Steal Like an Artist" framework.
  
  [CTA]
  Comment 'STEAL' for the guide.
  `;

  try {
    const start = Date.now();
    const url = await generateScriptImage(sampleScript);
    const duration = Date.now() - start;
    
    console.log(`\n✅ Image Generated and Uploaded in ${duration}ms`);
    console.log(`URL: ${url}`);
  } catch (error: any) {
    console.error("Test failed:", error.message);
    if (error.config) console.error("Failed Request URL:", error.config.url);
    if (error.response) console.error("Response Status:", error.response.status);
  }
}

runTest();
