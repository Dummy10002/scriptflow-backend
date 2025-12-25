import axios from 'axios';
import FormData from 'form-data';
import { logger } from './logger';
import { config } from '../config';
import { getBrowser } from '../services/browser';
import { Readable } from 'stream';

const IMGBB_API_KEY = config.IMGBB_API_KEY;

/**
 * Parse script into structured sections with VISUAL/SAY lines
 */
function parseScript(scriptText: string): { hook: string[], body: string[], cta: string[] } {
  const sections = { hook: [] as string[], body: [] as string[], cta: [] as string[] };
  
  // Split by section headers
  const parts = scriptText.split(/\[(HOOK|BODY|CTA)\]/i);
  
  for (let i = 1; i < parts.length; i += 2) {
    const header = parts[i]?.toUpperCase();
    const content = parts[i + 1]?.trim() || '';
    
    // Split content into lines
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (header === 'HOOK') sections.hook = lines;
    else if (header === 'BODY') sections.body = lines;
    else if (header === 'CTA') sections.cta = lines;
  }
  
  return sections;
}

/**
 * Format a line with proper styling based on type (VISUAL vs SAY)
 */
function formatLine(line: string): string {
  // Check if it's a VISUAL line
  if (line.includes('🎬') || line.toLowerCase().startsWith('visual:')) {
    const content = line.replace(/^🎬\s*VISUAL:\s*/i, '').replace(/^VISUAL:\s*/i, '');
    return `<div class="visual-line">
      <span class="visual-icon">🎬</span>
      <span class="visual-label">VISUAL:</span>
      <span class="visual-content">${escapeHtml(content)}</span>
    </div>`;
  }
  
  // Check if it's a SAY line
  if (line.includes('💬') || line.toLowerCase().startsWith('say:')) {
    const content = line.replace(/^💬\s*SAY:\s*/i, '').replace(/^SAY:\s*/i, '');
    return `<div class="say-line">
      <span class="say-icon">💬</span>
      <span class="say-label">SAY:</span>
      <span class="say-content">${escapeHtml(content)}</span>
    </div>`;
  }
  
  // Default: regular line
  return `<div class="regular-line">${escapeHtml(line)}</div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function generateScriptImage(scriptText: string): Promise<string> {
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // Parse script sections
    const sections = parseScript(scriptText);
    
    // Build HTML for each section
    const hookHtml = sections.hook.map(formatLine).join('\n');
    const bodyHtml = sections.body.map(formatLine).join('\n');
    const ctaHtml = sections.cta.map(formatLine).join('\n');

    // Set content with premium visual hierarchy layout
    await page.setContent(`
        <html>
          <head>
            <link href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,400&display=swap" rel="stylesheet">
            <style>
              * { box-sizing: border-box; }
              body {
                width: 1080px;
                padding: 60px;
                font-family: 'Satoshi', -apple-system, sans-serif;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                color: #fff;
                margin: 0;
              }
              
              .section {
                margin-bottom: 40px;
                background: rgba(255,255,255,0.05);
                border-radius: 16px;
                padding: 30px;
                backdrop-filter: blur(10px);
              }
              
              .section-header {
                font-size: 14px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 3px;
                color: #64ffda;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 2px solid rgba(100,255,218,0.3);
              }
              
              .visual-line {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                background: rgba(100,100,100,0.2);
                padding: 15px 20px;
                border-radius: 10px;
                margin-bottom: 12px;
                border-left: 4px solid #888;
              }
              
              .visual-icon { font-size: 20px; }
              .visual-label {
                font-size: 12px;
                font-weight: 700;
                color: #aaa;
                text-transform: uppercase;
                min-width: 60px;
              }
              .visual-content {
                font-size: 18px;
                font-style: italic;
                color: #ccc;
                line-height: 1.5;
              }
              
              .say-line {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                background: rgba(100,255,218,0.1);
                padding: 15px 20px;
                border-radius: 10px;
                margin-bottom: 12px;
                border-left: 4px solid #64ffda;
              }
              
              .say-icon { font-size: 20px; }
              .say-label {
                font-size: 12px;
                font-weight: 700;
                color: #64ffda;
                text-transform: uppercase;
                min-width: 60px;
              }
              .say-content {
                font-size: 22px;
                font-weight: 600;
                color: #fff;
                line-height: 1.5;
              }
              
              .regular-line {
                font-size: 20px;
                color: #ddd;
                line-height: 1.6;
                margin-bottom: 10px;
              }
              
              .cta-section {
                background: linear-gradient(135deg, rgba(100,255,218,0.2) 0%, rgba(100,255,218,0.05) 100%);
                border: 2px solid rgba(100,255,218,0.5);
              }
              
              .footer {
                text-align: center;
                margin-top: 30px;
                font-size: 14px;
                color: #666;
              }
            </style>
          </head>
          <body>
            
            ${hookHtml ? `
            <div class="section">
              <div class="section-header">🎯 HOOK</div>
              ${hookHtml}
            </div>` : ''}

            ${bodyHtml ? `
            <div class="section">
              <div class="section-header">📝 BODY</div>
              ${bodyHtml}
            </div>` : ''}

            ${ctaHtml ? `
            <div class="section cta-section">
              <div class="section-header">🚀 CTA</div>
              ${ctaHtml}
            </div>` : ''}

            ${!hookHtml && !bodyHtml && !ctaHtml ? `
            <div class="section">
              <div class="regular-line">${escapeHtml(scriptText)}</div>
            </div>` : ''}

          </body>
        </html>
    `);

    // Dynamic viewport height
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewport({ width: 1080, height: bodyHeight + 40 });

    // Screenshot
    const imageScreenshot = await page.screenshot({ fullPage: true, encoding: 'binary' });
    const imageBuffer = Buffer.from(imageScreenshot);
    
    logger.info('Image generated successfully, uploading to ImgBB...');

    const formData = new FormData();
    formData.append('image', Readable.from(imageBuffer), { filename: 'script.png' });

    const uploadResponse = await axios.post(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
      }
    );

    if (uploadResponse.data && uploadResponse.data.data && uploadResponse.data.data.url) {
      const imageUrl = uploadResponse.data.data.url;
      logger.info(`Image uploaded to ImgBB: ${imageUrl}`);
      return imageUrl;
    } else {
      throw new Error('ImgBB response did not contain URL');
    }

  } catch (error: any) {
    logger.error('Failed to generate or upload image: ' + (error.message || error));
    throw error;
  } finally {
    if (page) {
      await page.close().catch(e => logger.error(`Failed to close page: ${e}`));
    }
  }
}

