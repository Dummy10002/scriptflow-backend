import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { html } from 'satori-html';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import { config } from '../config';

const IMGBB_API_KEY = config.IMGBB_API_KEY;

// Load fonts once
const fontData = fs.readFileSync(path.join(process.cwd(), 'fonts', 'Inter-Bold.ttf'));
const fontDataRegular = fs.readFileSync(path.join(process.cwd(), 'fonts', 'Inter-Regular.ttf'));

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
    return `<div style="display: flex; align-items: flex-start; gap: 10px; background: rgba(100,100,100,0.2); padding: 15px 20px; border-radius: 10px; margin-bottom: 12px; border-left: 4px solid #888; width: 100%;">
      <span style="font-size: 20px;">🎬</span>
      <span style="font-size: 12px; font-weight: 700; color: #aaa; text-transform: uppercase; min-width: 60px;">VISUAL:</span>
      <span style="font-size: 18px; font-style: italic; color: #ccc; line-height: 1.5;">${escapeHtml(content)}</span>
    </div>`;
  }
  
  // Check if it's a SAY line
  if (line.includes('💬') || line.toLowerCase().startsWith('say:')) {
    const content = line.replace(/^💬\s*SAY:\s*/i, '').replace(/^SAY:\s*/i, '');
    return `<div style="display: flex; align-items: flex-start; gap: 10px; background: rgba(100,255,218,0.1); padding: 15px 20px; border-radius: 10px; margin-bottom: 12px; border-left: 4px solid #64ffda; width: 100%;">
      <span style="font-size: 20px;">💬</span>
      <span style="font-size: 12px; font-weight: 700; color: #64ffda; text-transform: uppercase; min-width: 60px;">SAY:</span>
      <span style="font-size: 22px; font-weight: 600; color: #fff; line-height: 1.5;">${escapeHtml(content)}</span>
    </div>`;
  }
  
  // Default: regular line
  return `<div style="font-size: 20px; color: #ddd; line-height: 1.6; margin-bottom: 10px;">${escapeHtml(line)}</div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function generateScriptImage(scriptText: string): Promise<string> {
  const startTime = Date.now();
  try {
    // Parse script sections
    const sections = parseScript(scriptText);
    
    // Build HTML for each section
    const hookHtml = sections.hook.map(formatLine).join('\n');
    const bodyHtml = sections.body.map(formatLine).join('\n');
    const ctaHtml = sections.cta.map(formatLine).join('\n');

    const template = html(`
      <div style="display: flex; flex-direction: column; width: 1080px; padding: 60px; font-family: 'Inter'; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff;">
        
        ${hookHtml ? `
        <div style="display: flex; flex-direction: column; margin-bottom: 40px; background: rgba(255,255,255,0.05); border-radius: 16px; padding: 30px;">
          <div style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; color: #64ffda; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid rgba(100,255,218,0.3);">🎯 HOOK</div>
          ${hookHtml}
        </div>` : ''}

        ${bodyHtml ? `
        <div style="display: flex; flex-direction: column; margin-bottom: 40px; background: rgba(255,255,255,0.05); border-radius: 16px; padding: 30px;">
          <div style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; color: #64ffda; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid rgba(100,255,218,0.3);">📝 BODY</div>
          ${bodyHtml}
        </div>` : ''}

        ${ctaHtml ? `
        <div style="display: flex; flex-direction: column; background: rgba(100,255,218,0.05); border: 2px solid rgba(100,255,218,0.5); border-radius: 16px; padding: 30px;">
          <div style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; color: #64ffda; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid rgba(100,255,218,0.3);">🚀 CTA</div>
          ${ctaHtml}
        </div>` : ''}

        ${!hookHtml && !bodyHtml && !ctaHtml ? `
        <div style="display: flex; flex-direction: column; background: rgba(255,255,255,0.05); border-radius: 16px; padding: 30px;">
          <div style="font-size: 20px; color: #ddd; line-height: 1.6;">${escapeHtml(scriptText)}</div>
        </div>` : ''}

        <div style="display: flex; justify-content: center; margin-top: 30px; font-size: 14px; color: #666;">Generated by ScriptFlow AI</div>
      </div>
    `);

    // Generate SVG with Satori
    const svg = await satori(template as any, {
      width: 1080,
      fonts: [
        {
          name: 'Inter',
          data: fontDataRegular,
          weight: 400,
          style: 'normal',
        },
        {
          name: 'Inter',
          data: fontData,
          weight: 700,
          style: 'normal',
        },
      ],
    });

    // Convert SVG to PNG using Resvg
    const resvg = new Resvg(svg, {
        background: 'rgba(0,0,0,0)',
        fitTo: {
            mode: 'width',
            value: 1080,
        },
    });
    
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    const generationTime = Date.now() - startTime;
    logger.info(`Image generated in ${generationTime}ms (Satori)`);

    // Upload to ImgBB
    const formData = new FormData();
    formData.append('image', pngBuffer, { filename: 'script.png' });

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
    // Fail gracefully? No, we need the image.
    throw error;
  }
}
