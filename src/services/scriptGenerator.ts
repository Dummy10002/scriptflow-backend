import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function generateScript(userIdea: string, transcript: string | null): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
You are an expert Instagram Reel scriptwriter.
Generate a script based on the following:

USER IDEA: "${userIdea}"
ORIGINAL REEL TRANSCRIPT (for structure inspiration): "${transcript || 'N/A'}"

REQUIREMENTS:
1. Valid Viral Structure: Hook -> Value/Story -> Call to action.
2. Tone: Engaging, concise, punchy.
3. Length: ~30-60 seconds.
4. Output Format (Strictly enforce this):

HOOK
[The hook script line]

BODY
[The main content script]

CTA
[The call to action]

Do NOT use Markdown formatting (like **bold** or ## headers).
Do NOT include emojis.
Do NOT include instructions like "Here is your script". Just the script.
    `;

    const result = await model.generateContent(prompt);
    const script = result.response.text();
    return script.trim();
  } catch (error) {
    logger.error('Script generation failed', error);
    throw new Error('Failed to generate script');
  }
}
