import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import { VideoAnalysis } from './videoAnalyzer';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface ScriptGeneratorOptions {
  userIdea: string;
  transcript: string | null;
  visualAnalysis?: VideoAnalysis | null;  // Enhanced visual context
}

/**
 * Generate a script using the "Steal Like an Artist" framework.
 * 
 * When visualAnalysis is provided, the script incorporates visual cues,
 * hook patterns, and scene flow from the reference video.
 */
export async function generateScript(options: ScriptGeneratorOptions): Promise<string>;
export async function generateScript(userIdea: string, transcript: string | null): Promise<string>;
export async function generateScript(
  optionsOrIdea: ScriptGeneratorOptions | string, 
  transcript?: string | null
): Promise<string> {
  // Handle both old and new signatures for backwards compatibility
  let userIdea: string;
  let transcriptText: string | null;
  let visualAnalysis: VideoAnalysis | null | undefined;

  if (typeof optionsOrIdea === 'string') {
    // Legacy signature: generateScript(userIdea, transcript)
    userIdea = optionsOrIdea;
    transcriptText = transcript ?? null;
    visualAnalysis = null;
  } else {
    // New signature: generateScript(options)
    userIdea = optionsOrIdea.userIdea;
    transcriptText = optionsOrIdea.transcript;
    visualAnalysis = optionsOrIdea.visualAnalysis;
  }

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

  // Build reference DNA section - now includes visual context if available
  let referenceDNA = '';
  
  if (transcriptText) {
    referenceDNA += `TRANSCRIPT (What was said):\n"${transcriptText}"\n\n`;
  }

  if (visualAnalysis) {
    if (visualAnalysis.visualCues.length > 0) {
      referenceDNA += `VISUAL HOOKS (What was shown):\n${visualAnalysis.visualCues.map(c => `- ${c}`).join('\n')}\n\n`;
    }
    if (visualAnalysis.hookType && visualAnalysis.hookType !== 'Unknown') {
      referenceDNA += `HOOK PATTERN: ${visualAnalysis.hookType}\n\n`;
    }
    if (visualAnalysis.tone && visualAnalysis.tone !== 'Unknown') {
      referenceDNA += `DETECTED TONE: ${visualAnalysis.tone}\n\n`;
    }
    if (visualAnalysis.sceneDescriptions.length > 0) {
      referenceDNA += `SCENE FLOW:\n${visualAnalysis.sceneDescriptions.join('\n')}\n\n`;
    }
  }

  if (!referenceDNA) {
    referenceDNA = 'No reference provided. Use an intense, strategic tone.';
  }

  const prompt = `
  Apply the "Steal Like an Artist" framework to generate a new script.

  REFERENCE DNA (The Source to Steal From):
  ${referenceDNA}

  NEW CONCEPT (The Topic to Apply the DNA to):
  "${userIdea}"

  INSTRUCTIONS:
  1. **LINGUISTIC STYLE TRANSFER**: Detect the exact language mix of the transcript. Output must match it.
  
  2. **STRICT OUTPUT FORMAT**: Each section MUST have BOTH visual direction AND spoken dialogue clearly separated:
     
     [HOOK]
     🎬 VISUAL: (Camera angle, framing, gesture, text overlay - what viewer SEES)
     💬 SAY: "(Exact words to speak - the dialogue)"

     [BODY]
     🎬 VISUAL: (Scene description, on-screen text, transitions)
     💬 SAY: "(Spoken content)"
     
     (Multiple VISUAL/SAY pairs allowed per section)

     [CTA]
     🎬 VISUAL: (Final visual setup, text overlay if any)
     💬 SAY: "(Call to action dialogue)"
     
  3. VISUAL GUIDELINES:
     - Be specific: "Close-up face shot" not just "camera on face"
     - Include text overlays: "Text appears: 'The 80/20 Rule'"
     - Note transitions: "Jump cut to screen recording"
     
  4. DIALOGUE GUIDELINES:
     - Keep it punchy and spoken-natural
     - Match the reference's language style (Hinglish, casual English, etc.)
     - PACING: 30-45 seconds total spoken time

  Return ONLY the structured script with [HOOK], [BODY], [CTA] headers and 🎬 VISUAL: / 💬 SAY: lines. No other text.`;

  try {
    const result = await model.generateContent(prompt);
    const script = result.response.text();
    return script.trim();
  } catch (error) {
    logger.error('Script generation failed', error);
    throw error;
  }
}
