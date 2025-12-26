
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { logger } from '../utils/logger';
import { config } from '../config';
import fs from 'fs';

// Define the interface for video analysis results
export interface VideoAnalysis {
  transcript: string | null;
  visualCues: string[];
  hookType: string;
  tone: string;
  sceneDescriptions: string[];
}

// Options for the analyzer
interface AnalyzeOptions {
  frames?: string[];
  audioPath?: string | null;
  includeAudio?: boolean;
}

// Model configuration with fallback hierarchy
const MODEL_HIERARCHY = [
  'gemini-2.5-flash',      // Primary (User requested)
  'gemini-2.5-flash-lite', // User requested fallback
  'gemini-1.5-flash',     // Standard fallback
  'gemini-1.5-flash-8b'   // Cheapest/Fastest fallback
];

// Initialize API Key validation on module load
const apiKey = config.GEMINI_API_KEY;
if (!apiKey || apiKey.length < 10) {
  logger.error('❌ Gemini API key missing or invalid');
} else {
  // SECURITY: Never log API key content, even partial
  logger.info('✅ Gemini API key validated');
}

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * File to GenerativePart converter (Async)
 */
async function fileToGenerativePart(path: string, mimeType: string): Promise<Part> {
  const data = await fs.promises.readFile(path);
  return {
    inlineData: {
      data: data.toString('base64'),
      mimeType
    },
  };
}

/**
 * Sleep helper for backoff
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Analyze video frames and/or audio using Gemini with fallback support
 */
export async function analyzeVideo(options: AnalyzeOptions): Promise<VideoAnalysis> {
  const { frames = [], audioPath, includeAudio } = options;
  
  // Input validation
  if (frames.length === 0 && !audioPath) {
    throw new Error('No input provided for analysis (frames or audio)');
  }

  // Optimize: Read files into memory ONCE to avoid repeated I/O in the loop
  const frameParts: Part[] = [];
  
  // Read frames in parallel
  if (frames.length > 0) {
    const framePromises = frames
      .filter(f => fs.existsSync(f))
      .map(f => fileToGenerativePart(f, 'image/jpeg'));
    
    frameParts.push(...await Promise.all(framePromises));
  }

  // Read audio
  let audioPart: Part | null = null;
  if (includeAudio && audioPath && fs.existsSync(audioPath)) {
    audioPart = await fileToGenerativePart(audioPath, 'audio/mp3');
  }

  // Prepare prompt
  const prompt = `
  Analyze this video content (frames and/or audio) to extract structured data for script generation.
  
  RETURN JSON ONLY with this structure:
  {
    "transcript": "Full spoken text from audio (if any). If none, null.",
    "visualCues": ["List of key visual elements, styles, or actions shown"],
    "hookType": "The type of psychological hook used (e.g., 'Negative visual', 'Stop scrolling', 'Controversial statement', 'Unknown')",
    "tone": "The overall emotional tone (e.g., 'High Energy', 'Educational', 'Sarcastic')",
    "sceneDescriptions": ["Chronological description of visual scenes shown in frames"]
  }
  
  Be precise and detailed.
  `;

  let lastError: any = null;

  // Try models in sequence
  for (const modelName of MODEL_HIERARCHY) {
    try {
      logger.info(`Attempting video analysis with model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });

      // Prepare parts
      const parts: (string | Part)[] = [prompt, ...frameParts];
      
      if (audioPart) {
        parts.push(audioPart);
      }

      const result = await model.generateContent(parts);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}') + 1;
      if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error('Invalid JSON response from Gemini');
      }
      
      const jsonStr = text.substring(jsonStart, jsonEnd);
      const data = JSON.parse(jsonStr) as VideoAnalysis;
      
      logger.info(`✅ Analysis successful with ${modelName}`);
      return data;

    } catch (error: any) {
      lastError = error;
      const isAuthError = error.message?.includes('403') || error.status === 403;
      const isRateLimit = error.message?.includes('429') || error.status === 429;
      const isServerError = error.message?.includes('500') || error.status === 500;

      logger.warn(`❌ Model ${modelName} failed: ${error.message}`);

      if (isAuthError) {
        // If auth error, retrying might not help unless we switch API usage pattern (or it's a permission issue with specific model)
        // We continue to next model in case it's a model-access issue.
        logger.warn(`Auth error on ${modelName}, trying next model...`);
      } else if (isRateLimit) {
        // Exponential backoff could be applied here, or just switch to cheaper model
        logger.warn(`Rate limit on ${modelName}, switching to fallback...`);
        await sleep(2000); // Short wait before next model
      } else if (isServerError) {
        logger.warn(`Server error on ${modelName}, switching to fallback...`);
      }
      
      // Continue loop to next model
    }
  }

  // If we get here, all models failed
  logger.error('All analysis models failed.');
  throw lastError || new Error('Video analysis failed on all models');
}
