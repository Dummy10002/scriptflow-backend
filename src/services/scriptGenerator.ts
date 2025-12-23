import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { logger } from '../utils/logger';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// --- Interfaces ---

interface VoiceGuide {
  userId: string;
  archetype: string;
  toneWords: string[];
  examples: string[];
  neverSay: string[];
}

// --- Helper Functions ---

async function getUserVoiceGuide(userId: string): Promise<VoiceGuide> {
  // TODO: Replace with real DB call
  return {
    userId,
    archetype: "Confident Expert",
    toneWords: ["authoritative", "witty", "specific", "high-status"],
    examples: [
      "Bad: 'In this video I will show you...'",
      "Good: 'Most people fail at X because...'",
      "Style: Short sentences. Logic gaps. Pattern interrupts."
    ],
    neverSay: ["in conclusion", "furthermore", "hope this helps", "generic advice"]
  };
}

async function refineWithMistral(rawScript: string, userIdea: string, voiceGuide: VoiceGuide): Promise<string> {
  if (!process.env.MISTRAL_API_KEY) {
    logger.warn('MISTRAL_API_KEY not found. Skipping refinement layer.');
    return rawScript;
  }

  const refinementPrompt = `
You are a World-Class Script Editor. Refine this script to be "Award-Winning" quality.

ORIGINAL SCRIPT:
${rawScript}

CONTEXT:
- Topic: ${userIdea}
- Brand Voice: ${voiceGuide.toneWords.join(", ")}
- Archetype: ${voiceGuide.archetype}

INSTRUCTIONS:
1. Tighten the Hook: Make it shorter and punchier (max 2 sentences).
2. Strengthen the Logic: Ensure the "Steal Like an Artist" insight lands comfortably.
3. Voice Check: Remove any words like: ${voiceGuide.neverSay.join(", ")}.
4. Formatting: Keep the [HOOK], [BODY], [CTA] headers.

Return ONLY the refined script. No conversational filler.
`;

  try {
    logger.info('Refining script with Mistral Small...');
    const response = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      {
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: 'You are a viral script editor.' },
          { role: 'user', content: refinementPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.7
      },
      { 
        headers: { 
          'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json'
        } 
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    logger.error('Mistral refinement failed', error);
    // Fallback to original script if refinement fails
    return rawScript;
  }
}

// --- Main Service ---

export async function generateScript(userIdea: string, transcript: string | null, userId: string = "default_user"): Promise<string> {
  // 1. Get User Voice Structure
  const voiceGuide = await getUserVoiceGuide(userId);

  // 2. Build the System Instruction (Creative DNA)
  // We preserve the "Steal Like an Artist" philosophy from the master prompt
  // but inject the specific brand voice elements.
  const systemInstruction = `You are a World-Class Creative Strategist who follows the "Steal Like an Artist" philosophy.

Brand Archetype: ${voiceGuide.archetype}
Tone: ${voiceGuide.toneWords.join(", ")}
Style Rules:
- No hashtags, no emojis, no markdown.
- High-status, punchy, calculated.
- NEVER say: ${voiceGuide.neverSay.join(", ")}.

Your goal is to perform a "Surgical Good Theft":
1. Analyze the DNA of the reference script provided (pacing, hooks, structure).
2. Emulate the *thinking* behind it, not the words.
3. Remix that structure into a new script for the user's concept.
4. Vocabulary: Use technical authority words (e.g., if UI/UX, use terms like 'visual hierarchy', '8pt grid', 'cognitive friction').`;

  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash-lite", // Using valid user model
    systemInstruction: systemInstruction
  });

  const prompt = `
  Apply the "Steal Like an Artist" framework to generate a new script.

  REFERENCE DNA (The Source to Steal From):
  "${transcript ? transcript : "No transcript provided. Use an intense, strategic tone."}"

  NEW CONCEPT (The Topic to Apply the DNA to):
  "${userIdea}"

  INSTRUCTIONS:
  1. **LINGUISTIC STYLE TRANSFER**: Detect the exact language mix of the transcript. Output must match it.
  
  2. STRUCTURE: Your output MUST be strictly structured into these three sections with specific headers:
     
     [HOOK]
     (The opening line. High status, punchy, or a "Do you know..." hook. Max 1-2 sentences.)

     [BODY]
     (The main strategic insight or logical leap. Apply the "Steal Like an Artist" framework here. Max 3-4 sentences.)

     [CTA]
     (A short, non-cringe call to action. e.g. "Comment 'Scale' for details" or "Follow for more".)
     
  3. DECONSTRUCT & TRANSFORMATION: Apply the reference video's logic to the NEW CONCEPT.
  4. PACING: Keep it tight (30-45 seconds spoken).

  Return ONLY the final spoken script text with the headers. Do not add markdown formatting like **bold** or *italic*.`;

  try {
    // 3. Generate Base Script (Layer 1)
    logger.info('Generating base script with Gemini 2.5 Flash Lite...');
    const result = await model.generateContent(prompt);
    const baseScript = result.response.text();

    // 4. Refine Script (Layer 2)
    const finalScript = await refineWithMistral(baseScript, userIdea, voiceGuide);
    
    return finalScript.trim();

  } catch (error) {
    logger.error('Script generation failed', error);
    // If we have a partial generation error, we might want to throw or return a fallback
    // For now, we propagate the error.
    if ((error as any).status === 404 || (error as any).status === 429) {
       // Fallback to older model if Flash Lite not found or quota issues
       logger.warn(`Flash Lite issue (Status ${(error as any).status}), retrying with version 2.0 (Lite)...`);
       const fallbackModel = genAI.getGenerativeModel({ 
         model: "gemini-2.0-flash-lite-001",
         systemInstruction: systemInstruction
       });
       const fallbackResult = await fallbackModel.generateContent(prompt);
       const baseScript = fallbackResult.response.text();
       
       // Refine the fallback script too
       const finalScript = await refineWithMistral(baseScript, userIdea, voiceGuide);
       return finalScript.trim();
    }
    throw error;
  }
}