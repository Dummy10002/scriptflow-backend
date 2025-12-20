import YtDlpWrap from 'yt-dlp-exec';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

// Max duration to process (to avoid huge files)
const MAX_DURATION_SEC = 300; // 5 minutes

export async function downloadReel(url: string, id: string): Promise<string> {
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  const outputPath = path.join(tempDir, `${id}.mp4`);

  logger.info(`Downloading reel: ${url} to ${outputPath}`);

  try {
    // Force mp4 for compatibility
    await YtDlpWrap(url, {
      output: outputPath,
      format: 'worst[ext=mp4]', // Lowest quality mp4 is fine for audio extraction
      maxFilesize: '50M',
      matchFilter: `duration <= ${MAX_DURATION_SEC}`,
      noPlaylist: true,
    });

    // Check if file exists
    if (!fs.existsSync(outputPath)) {
        throw new Error('File was not created by yt-dlp');
    }

    return outputPath;
  } catch (error: any) {
    logger.error('Failed to download reel', error);
    // If it was a timeout or filter error, throw specific
    if (error.message?.includes('duration')) {
        throw new Error('Video too long');
    }
    throw new Error(`Download failed: ${error.message}`);
  }
}
