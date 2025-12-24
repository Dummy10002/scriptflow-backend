import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import axios from 'axios';
import { logger } from '../utils/logger';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || '');

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

async function uploadToGemini(filePath: string, mimeType: string): Promise<string> {
  try {
    logger.info(`Uploading file to Gemini: ${filePath}`);
    const uploadResult = await fileManager.uploadFile(filePath, {
      mimeType,
      displayName: `Reel_${Date.now()}`,
    });

    const file = uploadResult.file;
    logger.info(`Uploaded file ${file.name}, uri: ${file.uri}`);

    // Wait for file to be active
    let state = file.state;
    while (state === FileState.PROCESSING) {
      logger.info('File is processing...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
      const cleanFile = await fileManager.getFile(file.name);
      state = cleanFile.state;
    }

    if (state === FileState.FAILED) {
      throw new Error('Video processing failed on Gemini side.');
    }

    return file.uri;
  } catch (error) {
    logger.error('Failed to upload file to Gemini', error);
    throw error;
  }
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
5. Visuals: Ensure stage directions are enclosed in (parentheses).
6. STRICT RULE: DO NOT use markdown. No bolding (**), no italics (*), no underscores (_). Write PLAIN TEXT only.

Return ONLY the refined script. No conversational filler.
`;

  try {
    logger.info('Refining script with Mistral Small...');
    const response = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      {
        model: 'labs-mistral-small-creative',
        messages: [
          { role: 'system', content: 'You are a World-Class Creative Editor.' },
          { role: 'user', content: refinementPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.85,
        top_p: 0.95
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

export async function generateScript(userIdea: string, videoPath: string, userId: string = "default_user"): Promise<{ script: string, visualAnalysis: string }> {
  // 1. Get User Voice Structure
  const voiceGuide = await getUserVoiceGuide(userId);

  // 2. Upload Video for Vision Analysis
  const videoUri = await uploadToGemini(videoPath, "video/mp4");

  // 3. Build the System Instruction
  const systemInstruction = `You are a World-Class Creative Strategist who follows the "Steal Like an Artist" philosophy.

Brand Archetype: ${voiceGuide.archetype}
Tone: ${voiceGuide.toneWords.join(", ")}
Style Rules:
- No hashtags, no emojis, no markdown.
- High-status, punchy, calculated.
- NEVER say: ${voiceGuide.neverSay.join(", ")}.

CRITICAL LANGUAGE RULE: 
- **DETECT THE LANGUAGE/DIALECT** of the speaker in the video.
- **MATCH IT EXACTLY**.
- If the speaker uses **"Hinglish"** (Hindi + English mix), write the script in **Hinglish**.
- If they speak Spanish, write in Spanish.
- Do NOT translate Hinglish into formal English. Keep the "Desi" vibe if present.

Your goal is to perform a "Surgical Good Theft" using VISION + AUDIO:
1. Analyze the VISUAL PACING (cuts, zooms, energy) and AUDIO STRUCTURE of the reference video.
2. Emulate the *thinking* behind it, not just the words.
3. Remix that structure into a new script for the user's concept.
4. Vocabulary: Use technical authority words.`;

  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash-lite",
    systemInstruction: systemInstruction,
    generationConfig: {
        temperature: 0.85,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
    }
  });

  const prompt = `
  Apply the "Steal Like an Artist" framework to generate a new script.

  REFERENCE DNA (The Source to Steal From):
  [VIDEO ATTACHED] - Watch this video. Analyze Visual Pattern & Audio Pattern.

  NEW CONCEPT (The Topic to Apply the DNA to):
  "${userIdea}"

  INSTRUCTIONS:
  1. **ANALYSIS FIRST**: Start by writing a section called [VISUAL DNA]. Describe the visual/audio cues you see (cuts, energy, zooms) that make this viral.
  2. **SCRIPT GENERATION**: Then, write a section called [SCRIPT]. Apply that DNA to the new concept.

  STRUCTURE YOUR OUTPUT EXACTLY LIKE THIS:
  
  [VISUAL DNA]
  (Your analysis here...)

  [SCRIPT]
  [HOOK]
  (Opening line + Visual Cue)
  
  [BODY]
  (Main insight)
  
  [CTA]
  (Call to action)

  Return ONLY these two sections.`;

  try {
    // 4. Generate Base Script (Layer 1)
    logger.info('Generating base script with Gemini 2.5 Flash Lite (Vision Mode)...');
    
    // Logic for running model with video
    const runGeneration = async (m: any) => {
        return await m.generateContent([
            { text: prompt },
            { fileData: { mimeType: "video/mp4", fileUri: videoUri } }
        ]);
    };

    let result;
    try {
        result = await runGeneration(model);
    } catch (error) {
         if ((error as any).status === 404 || (error as any).status === 429) {
            logger.warn(`Flash Lite issue (Status ${(error as any).status}), retrying with version 2.0 (Lite)...`);
            const fallbackModel = genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash-lite-001",
                systemInstruction: systemInstruction,
                generationConfig: {
                    temperature: 0.85,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 2048,
                }
            });
            result = await runGeneration(fallbackModel);
         } else {
             throw error;
         }
    }
    
    const fullOutput = result.response.text();

    // 5. Parse Output
    const parts = fullOutput.split('[SCRIPT]');
    const visualAnalysis = parts[0].replace('[VISUAL DNA]', '').trim();
    const baseScript = parts.length > 1 ? parts[1].trim() : fullOutput; // Fallback if parse fails

    // 6. Refine Script (Layer 2) - Only refine the script part
    const finalScript = await refineWithMistral(baseScript, userIdea, voiceGuide);
    
    return { script: finalScript.trim(), visualAnalysis };

  } catch (error) {
    logger.error('Script generation failed', error);
    throw error;
  }
}
