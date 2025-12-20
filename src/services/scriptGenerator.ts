import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function generateScript(userIdea: string, transcript: string | null): Promise<string> {
  const model = genAI.getGenerativeModel({ 
    // Recommended: Use gemini-1.5-flash or gemini-2.0-flash
    model: "gemini-2.5-flash", 
    systemInstruction: `You are a World-Class Creative Strategist who follows the "Steal Like an Artist" philosophy. 
    
    Your goal is to perform a "Surgical Good Theft": 
    1. Analyze the DNA of a reference video (its pacing, psychological hooks, and logical structure).
    2. Emulate the *thinking* behind the reference, not the words.
    3. Remix that structure into a new script based on the user's specific concept.
    
    Rules:
    - No hashtags, no emojis, and no markdown.
    - Style: High-status, punchy, and calculated.
    - Tone: Pivot from a surface-level hook to a deep strategic truth.
    - Vocabulary: Use technical authority words (e.g., if UI/UX, use terms like 'visual hierarchy', '8pt grid', 'cognitive friction').`
  });

  const prompt = `
  Apply the "Steal Like an Artist" framework to generate a new script.

  REFERENCE DNA (The Source to Steal From):
  "${transcript ? transcript : "No transcript provided. Use an intense, strategic tone."}"

  NEW CONCEPT (The Topic to Apply the DNA to):
  "${userIdea}"

  INSTRUCTIONS:
  1. DECONSTRUCT: Identify the reference video's rhythm. If it starts with a character obsession or a "Do you know why..." hook, use that same opening logic.
  2. TRANSFORMATION: Apply that logic to the NEW CONCEPT. Do not mention the characters or objects from the reference; only steal the "Logical Leap" (the 'If/Then' statement).
  3. PACING: Match the timing of the reference (roughly 30–45 seconds).
  4. PROOF: Use modern authority figures or industry standards relevant to the NEW CONCEPT to prove the point.

  Return ONLY the final spoken script text.`;

  try {
    const result = await model.generateContent(prompt);
    const script = result.response.text();
    return script.trim();
  } catch (error) {
    logger.error('Script generation failed', error);
    throw error;
  }
}