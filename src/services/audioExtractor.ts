import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

export async function extractAudio(videoPath: string, id: string): Promise<string | null> {
  const outputPath = path.join(path.dirname(videoPath), `${id}.wav`);

  return new Promise((resolve) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .toFormat('wav')
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (err) => {
        // Check if error implies no audio
        // Usually ffmpeg errors like "Output file is empty" or "Stream map '0:a' matches no streams"
        logger.warn(`Audio extraction issue (possibly silent video): ${err.message}`);
        resolve(null);
      })
      .save(outputPath);
  });
}
