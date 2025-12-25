import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import { logger } from '../utils/logger';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function transcribeAudio(audioPath: string | null): Promise<string | null> {
  if (!audioPath || !fs.existsSync(audioPath)) {
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const audioBuffer = fs.readFileSync(audioPath);
    const base64Audio = audioBuffer.toString('base64');

    const result = await model.generateContent([
      "Transcribe the spoken audio in this file exactly. If there is no speech, output nothing.",
      {
        inlineData: {
          mimeType: "audio/wav",
          data: base64Audio
        }
      }
    ]);

    const text = result.response.text();
    return text.trim() || null;
  } catch (error) {
    logger.error('Transcription failed', error);
    return null;
  }
}
