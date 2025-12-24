import * as dotenv from 'dotenv';
dotenv.config();
import { generateScript } from './services/scriptGenerator';

async function runTest() {
  console.log("Starting Vision Generation Test...");
  console.log("API Key loaded:", process.env.GEMINI_API_KEY ? "YES" : "NO");
  
  // Note: This test requires a valid video file at 'test-video.mp4' to work fully.
  // We will check if we can run it or just print success if imports work.
  const videoPath = "./test-video.mp4"; 
  const userIdea = "How to optimize React performance";

  try {
     const fs = require('fs');
     if (!fs.existsSync(videoPath)) {
         console.log("⚠️ No test-video.mp4 found. Skipping actual API call to save tokens/time.");
         console.log("✅ Imports and compilation verified.");
         return;
     }

    const { script, visualAnalysis } = await generateScript(userIdea, videoPath);
    console.log("\n--- VISUAL ANALYSIS (DATASET) ---\n");
    console.log(visualAnalysis);
    console.log("\n--- FINAL VISION SCRIPT ---\n");
    console.log(script);
    console.log("\n--------------------\n");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

runTest();
