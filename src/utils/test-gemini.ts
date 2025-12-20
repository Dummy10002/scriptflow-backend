
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('No API Key found');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // We cannot list models with the high-level SDK easily in older versions, 
  // but let's try a direct fetch if possible or just try to generate on gemini-1.0-pro
  console.log("Checking gemini-2.5-flash (block 1)...");
  try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent("Hello");
      console.log("Success with gemini-2.5-flash (block 1)!");
  } catch (e: any) {
      console.log("Failed gemini-2.5-flash (block 1):", e.message);
  }

  console.log("Checking gemini-2.5-flash (block 2)...");
  try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent("Hello");
      console.log("Success with gemini-2.5-flash (block 2)!");
  } catch (e: any) {
      console.log("Failed gemini-2.5-flash (block 2):", e.message);
  }
}

main();
