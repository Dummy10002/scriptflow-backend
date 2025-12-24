import * as dotenv from 'dotenv';
dotenv.config();

// Mock Env for Config
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';
process.env.API_SECRET_KEY = process.env.API_SECRET_KEY || 'testsecret';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

import { generateScript } from './services/scriptGenerator';
import { generateScriptImage } from './utils/imageGenerator';

async function runEndToEnd() {
  console.log("🚀 Starting Full Pipeline Simulation...");
  console.log("1. Environment Check:");
  console.log("   - Mistral Key: " + (process.env.MISTRAL_API_KEY ? "OK" : "MISSING"));
  console.log("   - Gemini Key: " + (process.env.GEMINI_API_KEY ? "OK" : "MISSING"));

  const videoPath = "./test-video.mp4";
  const userIdea = "The hidden psychology of color in marketing";

  try {
     const fs = require('fs');
     let scriptText = "";
     
     // STEP 1: VISION Generation
     if (!fs.existsSync(videoPath)) {
         console.log("\n⚠️ Video file missing. Using MOCK SCRIPT to test downstream flow.");
         scriptText = `
[VISUAL DNA]
Fast cuts, high contrast, red overlays.

[SCRIPT]
[HOOK]
The color red makes you buy. [Zoom in on coke can]

[BODY]
Brands use red to trigger hunger and urgency. It's biological.
That's why Netflix, Coca-Cola, and Target all use it.

[CTA]
Follow for more psych tricks.
         `;
         // Parse it manually to simulate generateScript return
         const parts = scriptText.split('[SCRIPT]');
         scriptText = parts[1].trim();
         console.log("   (Skipped Vision API due to missing file)");
     } else {
         console.log("\n👁️ Step 1: Vision Analysis (Gemini Flash Lite)...");
         const result = await generateScript(userIdea, videoPath);
         scriptText = result.script;
         console.log("   > Visual Analysis: " + result.visualAnalysis.substring(0, 50) + "...");
         console.log("   > Script Generated.");
     }

     // STEP 2: IMAGE Generation
     console.log("\n🎨 Step 2: Image Generation (Satori)...");
     const imageUrl = await generateScriptImage(scriptText);
     console.log("   > Image URL: " + imageUrl);

     console.log("\n✅ Pipeline Complete.");

  } catch (error: any) {
    console.error("\n❌ Pipeline Failed:", error.message);
    if(error.response) console.log("   Status:", error.response.status);
  }
}

runEndToEnd();
