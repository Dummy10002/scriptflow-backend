import * as dotenv from 'dotenv';
dotenv.config();

import { generateScript } from './services/scriptGenerator';

async function runTest() {
  console.log("Starting Hybrid Generation Test...");
  console.log("API Key loaded:", process.env.GEMINI_API_KEY ? "YES" : "NO");
  
  const userIdea = "How to make a perfect grilled cheese sandwich";
  const dummyTranscript = "Listen, 99% of people burn the bread. The secret isn't the heat, it's the mayo. Use mayo instead of butter, low heat, cover the pan.";

  try {
    const script = await generateScript(userIdea, dummyTranscript);
    console.log("\n--- FINAL SCRIPT ---\n");
    console.log(script);
    console.log("\n--------------------\n");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

runTest();
