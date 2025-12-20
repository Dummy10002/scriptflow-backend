import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function generateScript(userIdea: string): Promise<string> {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `You are a professional Instagram Reel scriptwriter.

You write short-form scripts (30–45 seconds) that are:
- Hook-driven
- Conversational
- Easy to perform
- Optimized for Instagram Reels

Rules:
- No hashtags
- No emojis
- No markdown
- Simple spoken English`
  });

  const prompt = `Create an Instagram Reel script based on this idea:

IDEA:
${userIdea}

CONTEXT:
This script should feel inspired by an existing reel, but it must be original.

STRUCTURE:
- Strong hook in the first 2–3 seconds
- Clear, punchy core message
- Simple call-to-action at the end

CONSTRAINTS:
- 30–45 seconds total
- Readable in Instagram DMs
- Short lines

Return only the script text.`;

  try {
    const result = await model.generateContent(prompt);
    const script = result.response.text();
    return script.trim();
  } catch (error) {
    logger.error('Script generation failed', error);
    // Rethrow to let the controller handle the fallback
    throw error;
  }
}
