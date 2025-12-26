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

// Load fonts once (Poppins - universal, modern, excellent readability)
const fontDataBold = fs.readFileSync(path.join(process.cwd(), 'fonts', 'Poppins-Bold.ttf'));
const fontDataSemiBold = fs.readFileSync(path.join(process.cwd(), 'fonts', 'Poppins-SemiBold.ttf'));
const fontDataRegular = fs.readFileSync(path.join(process.cwd(), 'fonts', 'Poppins-Regular.ttf'));

// ============================================
// IMPROVED MINIMALIST DARK PALETTE
// Clean, professional, high-readability
// ============================================
const COLORS = {
  // Background
  bgGradientStart: '#0F0F0F',      // True black
  bgGradientEnd: '#1A1A1A',        // Slightly lighter

  // Cards
  cardBg: 'rgba(255,255,255,0.03)', // Very subtle
  cardBorder: 'rgba(255,255,255,0.06)',

  // Text
  textPrimary: '#FFFFFF',           // Pure white for dialogue
  textSecondary: '#9CA3AF',         // Muted gray for visuals

  // Accents (muted, not neon)
  visualAccent: '#6B7280',          // Cool gray for VISUAL
  sayAccent: '#10B981',             // Emerald green for SAY
  sectionHeader: '#6B7280',         // Gray headers

  // Dividers
  divider: 'rgba(255,255,255,0.06)',

  // Watermark
  watermark: '#4B5563'
};

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
 * IMPROVED: Cleaner design, better contrast, no neon colors
 */
function formatLine(line: string, isLast: boolean = false): string {
  const borderStyle = isLast ? '' : `border-bottom: 1px solid ${COLORS.divider};`;
  
  // Check if it's a VISUAL line
  if (line.includes('🎬') || line.toLowerCase().startsWith('visual:')) {
    const content = line.replace(/^🎬\s*VISUAL:\s*/i, '').replace(/^VISUAL:\s*/i, '');
    return `<div style="display: flex; align-items: flex-start; gap: 16px; padding: 16px 0; ${borderStyle}">
      <span style="font-size: 10px; font-weight: 600; color: ${COLORS.visualAccent}; text-transform: uppercase; min-width: 52px; padding-top: 5px; letter-spacing: 0.5px;">VISUAL</span>
      <span style="font-size: 16px; color: ${COLORS.textSecondary}; line-height: 1.6; font-style: italic;">${escapeHtml(content)}</span>
    </div>`;
  }
  
  // Check if it's a SAY line
  if (line.includes('💬') || line.toLowerCase().startsWith('say:')) {
    const content = line.replace(/^💬\s*SAY:\s*/i, '').replace(/^SAY:\s*/i, '');
    return `<div style="display: flex; align-items: flex-start; gap: 16px; padding: 16px 0; ${borderStyle}">
      <span style="font-size: 10px; font-weight: 600; color: ${COLORS.sayAccent}; text-transform: uppercase; min-width: 52px; padding-top: 5px; letter-spacing: 0.5px;">SAY</span>
      <span style="font-size: 18px; font-weight: 500; color: ${COLORS.textPrimary}; line-height: 1.5;">${escapeHtml(content)}</span>
    </div>`;
  }
  
  // Default: regular line
  return `<div style="font-size: 16px; color: ${COLORS.textSecondary}; line-height: 1.6; padding: 12px 0; ${borderStyle}">${escapeHtml(line)}</div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Create section header HTML (clean, no emojis, uppercase)
 */
function createSectionHeader(title: string): string {
  return `<div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: ${COLORS.sectionHeader}; margin-bottom: 8px; padding-bottom: 12px; border-bottom: 1px solid ${COLORS.divider};">${title}</div>`;
}

/**
 * Format all lines in a section
 */
function formatSection(lines: string[]): string {
  return lines.map((line, idx) => formatLine(line, idx === lines.length - 1)).join('\n');
}

export async function generateScriptImage(scriptText: string): Promise<string> {
  const startTime = Date.now();
  try {
    // Parse script sections
    const sections = parseScript(scriptText);
    
    // Build HTML for each section
    const hookHtml = formatSection(sections.hook);
    const bodyHtml = formatSection(sections.body);
    const ctaHtml = formatSection(sections.cta);

    const template = html(`
      <div style="display: flex; flex-direction: column; width: 1080px; padding: 56px; font-family: 'Poppins'; background: linear-gradient(180deg, ${COLORS.bgGradientStart} 0%, ${COLORS.bgGradientEnd} 100%); color: ${COLORS.textPrimary};">
        
        ${hookHtml ? `
        <div style="display: flex; flex-direction: column; margin-bottom: 32px; background: ${COLORS.cardBg}; border: 1px solid ${COLORS.cardBorder}; border-radius: 12px; padding: 24px;">
          ${createSectionHeader('HOOK')}
          ${hookHtml}
        </div>` : ''}

        ${bodyHtml ? `
        <div style="display: flex; flex-direction: column; margin-bottom: 32px; background: ${COLORS.cardBg}; border: 1px solid ${COLORS.cardBorder}; border-radius: 12px; padding: 24px;">
          ${createSectionHeader('BODY')}
          ${bodyHtml}
        </div>` : ''}

        ${ctaHtml ? `
        <div style="display: flex; flex-direction: column; background: ${COLORS.cardBg}; border: 1px solid ${COLORS.cardBorder}; border-radius: 12px; padding: 24px;">
          ${createSectionHeader('CALL TO ACTION')}
          ${ctaHtml}
        </div>` : ''}

        ${!hookHtml && !bodyHtml && !ctaHtml ? `
        <div style="display: flex; flex-direction: column; background: ${COLORS.cardBg}; border: 1px solid ${COLORS.cardBorder}; border-radius: 12px; padding: 24px;">
          <div style="font-size: 18px; color: ${COLORS.textSecondary}; line-height: 1.6;">${escapeHtml(scriptText)}</div>
        </div>` : ''}

        <div style="display: flex; justify-content: center; margin-top: 24px; font-size: 11px; color: ${COLORS.watermark}; letter-spacing: 1px;">SCRIPTFLOW AI</div>
      </div>
    `);

    // Generate SVG with Satori
    const svg = await satori(template as any, {
      width: 1080,
      fonts: [
        {
          name: 'Poppins',
          data: fontDataRegular,
          weight: 400,
          style: 'normal',
        },
        {
          name: 'Poppins',
          data: fontDataSemiBold,
          weight: 600,
          style: 'normal',
        },
        {
          name: 'Poppins',
          data: fontDataBold,
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
        timeout: 30000  // 30 second timeout
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
  }
}
