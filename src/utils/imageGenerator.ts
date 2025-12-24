import axios from 'axios';
import FormData from 'form-data';
import { logger } from './logger';
import { config } from '../config';
import { Readable } from 'stream';
import satori from 'satori';
import { html } from 'satori-html';
import sharp from 'sharp';

const IMGBB_API_KEY = config.IMGBB_API_KEY;

// Cache fonts in memory
let fontRegular: Buffer | null = null;
let fontBold: Buffer | null = null;

async function loadFonts() {
  if (fontRegular && fontBold) return { fontRegular, fontBold };

  logger.info('Downloading fonts for image generation...');
  const [regRes, boldRes] = await Promise.all([
    axios.get('https://unpkg.com/@fontsource/inter@5.0.15/files/inter-latin-400-normal.woff', { responseType: 'arraybuffer' }),
    axios.get('https://unpkg.com/@fontsource/inter@5.0.15/files/inter-latin-700-normal.woff', { responseType: 'arraybuffer' })
  ]);

  fontRegular = Buffer.from(regRes.data);
  fontBold = Buffer.from(boldRes.data);
  logger.info('Fonts loaded into memory.');
  return { fontRegular, fontBold };
}

// Helper to clean and format text
function formatTextForSatori(text: string): string {
    if (!text) return '';
    
    // 1. Remove Markdown artifacts
    let clean = text.replace(/(\*\*|\*|__)/g, '');

    // 2. Split by Visual Cues (parentheses)
    const parts = clean.split(/(\([^)]+\))/g);
    
    return parts.map(part => {
        if (!part.trim()) return '';
        
        if (part.startsWith('(') && part.endsWith(')')) {
            // Visual Cue -> Distinct, Compact Box
            const content = part.slice(1, -1); // remove parens for cleaner look
            return `
            <div style="display: flex; flex-direction: row; align-items: flex-start; width: 100%; background-color: #f3f4f6; border-radius: 8px; padding: 12px 20px; margin-top: 12px; margin-bottom: 12px;">
                <span style="font-size: 24px; margin-right: 12px; opacity: 0.7;">👁️</span>
                <span style="font-size: 24px; color: #4b5563; font-family: 'Inter'; font-weight: 500; font-style: italic; line-height: 1.4;">${content}</span>
            </div>`;
        } else {
            // Dialogue -> Text Block
            // We use a clean block
            return `
            <div style="display: flex; width: 100%; margin-top: 8px; margin-bottom: 8px;">
                 <span style="font-size: 36px; color: #111827; font-family: 'Inter'; font-weight: 400; line-height: 1.5;">${part}</span>
            </div>`; 
        }
    }).join('');
}

export async function generateScriptImage(scriptText: string): Promise<string> {
  try {
    // 1. Prepare Content
    let hook = '', body = '', cta = '';
    const parts = scriptText.split(/\[(HOOK|BODY|CTA)\]/i);
    // Fallback
    if (parts.length < 2) {
       hook = "Script Output";
       body = scriptText;
    } else {
        for (let i = 1; i < parts.length; i += 2) {
            const header = parts[i].toUpperCase();
            const content = parts[i+1]?.trim() || '';
            if (header === 'HOOK') hook = content;
            else if (header === 'BODY') body = content;
            else if (header === 'CTA') cta = content;
        }
    }

    // 2. Load Fonts
    const { fontRegular, fontBold } = await loadFonts();

    // 3. Define Aesthetic Template (Fixed Overflow & Distinction)
    // - Reduced margins/padding (80px -> 60px).
    // - Smaller font sizes (Hook 56->48, Title 24->20).
    
    const template = html(`
      <div style="display: flex; flex-direction: column; width: 1080px; height: 1920px; background-color: #ffffff; padding: 60px; justify-content: flex-start; align-items: flex-start;">
        
        <!-- Header -->
        <div style="display: flex; width: 100%; border-bottom: 2px solid #e5e7eb; padding-bottom: 30px; margin-bottom: 40px;">
           <span style="font-size: 20px; color: #9ca3af; font-family: 'Inter'; font-weight: 700; letter-spacing: 3px; text-transform: uppercase;">ScriptFlow AI</span>
        </div>

        <!-- Hook Section -->
        ${hook ? `
        <div style="display: flex; flex-direction: row; width: 100%; margin-bottom: 40px;">
           <div style="display: flex; width: 8px; background-color: #000000; margin-right: 32px; border-radius: 4px;"></div>
           <div style="display: flex; flex-direction: column; flex: 1;">
               <span style="font-size: 48px; color: #000000; font-weight: 700; line-height: 1.3;">
                 ${formatTextForSatori(hook)}
               </span>
           </div>
        </div>
        ` : ''}

        <!-- Body Section -->
        ${body ? `
        <div style="display: flex; flex-direction: column; width: 100%; margin-bottom: 40px; flex-grow: 1; overflow: hidden;">
           <div style="display: flex; flex-direction: column;">
             ${formatTextForSatori(body)}
           </div>
        </div>
        ` : ''}

        <!-- CTA Section -->
        ${cta ? `
        <div style="display: flex; width: 100%; justify-content: center; margin-top: auto; padding-top: 40px;">
           <div style="display: flex; background-color: #f3f4f6; color: #1f2937; padding: 24px 60px; border-radius: 999px; font-size: 32px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">
             ${formatTextForSatori(cta)}
           </div>
        </div>
        ` : ''}
        
      </div>
    `);

    // 4. Generate SVG
    logger.info('Generating SVG with Satori...');
    const svg = await satori(template as any, {
      width: 1080,
      height: 1920,
      fonts: [
        { name: 'Inter', data: fontRegular!, weight: 400, style: 'normal' },
        { name: 'Inter', data: fontBold!, weight: 700, style: 'normal' },
        { name: 'Inter', data: fontRegular!, weight: 500, style: 'italic' } 
      ]
    });

    // 5. Convert to PNG
    logger.info('Converting SVG to PNG with Sharp...');
    const imageBuffer = await sharp(Buffer.from(svg))
        .png({ quality: 90 }) 
        .toBuffer();

    // 6. Upload
    logger.info(`Image generated (${imageBuffer.length} bytes). Uploading to ImgBB...`);
    const formData = new FormData();
    formData.append('image', Readable.from(imageBuffer), { filename: 'script.png' });

    const uploadResponse = await axios.post(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      formData,
      { headers: { ...formData.getHeaders() } }
    );

    if (uploadResponse.data?.data?.url) {
      const imageUrl = uploadResponse.data.data.url;
      logger.info(`Image uploaded: ${imageUrl}`);
      return imageUrl;
    } else {
      throw new Error('ImgBB response missing URL');
    }

  } catch (error: any) {
    logger.error('Failed to generate image: ' + (error.message || error));
    throw error;
  }
}
