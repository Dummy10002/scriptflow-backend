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
  // Minimalist Palette
  bgDark: '#09090b',         // Zinc 950
  bgSurface: '#18181b',      // Zinc 900
  textMain: '#fafafa',       // Zinc 50
  textDim: '#a1a1aa',        // Zinc 400
  textMuted: '#52525b',      // Zinc 600
  
  // Refined Accents
  accent: '#22d3ee',         // Cyan 400 (Soft Electric Cyan)
  accentMuted: 'rgba(34, 211, 238, 0.1)',
  border: 'rgba(255, 255, 255, 0.06)',
  divider: 'rgba(255, 255, 255, 0.03)',
  
  // Section Glows
  cardBg: 'rgba(24, 24, 27, 0.6)',
  visualGlow: 'rgba(161, 161, 170, 0.03)',
  sayGlow: 'rgba(34, 211, 238, 0.02)',
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
function formatLine(visual: string | null, say: string | null, isLast: boolean = false): string {
  const borderStyle = isLast ? '' : `border-bottom: 1px solid ${COLORS.divider};`;
  
  // Generic text fallback
  if (!visual?.match(/🎬|VISUAL:/i) && !say?.match(/💬|SAY:/i) && visual) {
    return `<div style="display: flex; padding: 24px; ${borderStyle} color: ${COLORS.textDim}; font-size: 15px; line-height: 1.6;">${escapeHtml(visual)}</div>`;
  }

  return `<div style="display: flex; align-items: stretch; gap: 0; padding: 24px 0; ${borderStyle}">
    <!-- Visual Side (40%) -->
    <div style="display: flex; flex-direction: column; width: 400px; padding-right: 32px; border-right: 1px solid ${COLORS.divider};">
      <div style="display: flex; font-size: 9px; font-weight: 700; color: ${COLORS.textMuted}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">VISUAL</div>
      <div style="display: flex; font-size: 14px; color: ${COLORS.textDim}; line-height: 1.7; font-style: italic; opacity: 0.9;">${visual ? escapeHtml(visual.replace(/^🎬\s*VISUAL:\s*/i, '').replace(/^VISUAL:\s*/i, '')) : '—'}</div>
    </div>
    
    <!-- Dialogue Side (60%) -->
    <div style="display: flex; flex-direction: column; flex: 1; padding-left: 40px; background: ${say ? COLORS.sayGlow : 'transparent'};">
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
        <span style="display: flex; font-size: 9px; font-weight: 800; color: ${COLORS.accent}; text-transform: uppercase; letter-spacing: 3px;">DIALOGUE</span>
      </div>
      <div style="display: flex; font-size: 22px; font-weight: 600; color: ${COLORS.textMain}; line-height: 1.4; letter-spacing: -0.4px;">${say ? escapeHtml(say.replace(/^💬\s*SAY:\s*/i, '').replace(/^SAY:\s*/i, '')) : '—'}</div>
    </div>
  </div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '"') // Satori handles raw quotes better than &quot;
    .replace(/'/g, "'");
}

/**
 * Create section header HTML (clean, no emojis, uppercase)
 */
function createSectionHeader(title: string): string {
  return `<div style="display: flex; align-items: center; margin-bottom: 24px; gap: 16px;">
    <div style="display: flex; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 4px; color: ${COLORS.textMuted};">${title}</div>
    <div style="display: flex; flex: 1; height: 1px; background: ${COLORS.divider};"></div>
  </div>`;
}

/**
 * Format all lines in a section (Pairing Visual + Say)
 */
function formatSection(lines: string[]): string {
  const paired: { visual: string | null, say: string | null }[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isVisual = line.includes('🎬') || line.toLowerCase().startsWith('visual:');
    const isSay = line.includes('💬') || line.toLowerCase().startsWith('say:');
    
    if (isVisual) {
      // Look ahead for a matching SAY
      const nextLine = lines[i + 1];
      if (nextLine && (nextLine.includes('💬') || nextLine.toLowerCase().startsWith('say:'))) {
        paired.push({ visual: line, say: nextLine });
        i++; // skip next
      } else {
        paired.push({ visual: line, say: null });
      }
    } else if (isSay) {
      paired.push({ visual: null, say: line });
    } else {
      paired.push({ visual: line, say: null });
    }
  }
  
  return paired.map((pair, idx) => formatLine(pair.visual, pair.say, idx === paired.length - 1)).join('\n');
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
      <div style="display: flex; flex-direction: column; width: 1080px; padding: 64px; font-family: 'Poppins'; background: ${COLORS.bgDark}; color: ${COLORS.textMain};">
        
        <!-- Minimalist Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 48px; border-bottom: 1px solid ${COLORS.divider}; padding-bottom: 32px;">
          <div style="display: flex; flex-direction: column;">
            <div style="display: flex; font-size: 32px; font-weight: 800; color: ${COLORS.textMain}; letter-spacing: -1.5px;">SCRIPT<span style="color: ${COLORS.accent};">FLOW</span></div>
            <div style="display: flex; font-size: 11px; color: ${COLORS.textMuted}; font-weight: 600; text-transform: uppercase; letter-spacing: 5px; margin-top: 4px;">Studio Blueprint</div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="display: flex; font-size: 10px; font-weight: 700; color: ${COLORS.textMuted}; letter-spacing: 2px;">V2.5.0</div>
            <div style="display: flex; width: 6px; height: 6px; border-radius: 50%; background: ${COLORS.accent};"></div>
          </div>
        </div>

        <!-- Compact Content Sections -->
        ${hookHtml ? `
        <div style="display: flex; flex-direction: column; margin-bottom: 40px; background: ${COLORS.cardBg}; border: 1px solid ${COLORS.border}; border-radius: 12px; padding: 32px;">
          ${createSectionHeader('01 / HOOK')}
          <div style="display: flex; flex-direction: column;">
            ${hookHtml}
          </div>
        </div>` : ''}

        ${bodyHtml ? `
        <div style="display: flex; flex-direction: column; margin-bottom: 40px; background: ${COLORS.cardBg}; border: 1px solid ${COLORS.border}; border-radius: 12px; padding: 32px;">
          ${createSectionHeader('02 / SCENE BREAKDOWN')}
          <div style="display: flex; flex-direction: column;">
            ${bodyHtml}
          </div>
        </div>` : ''}

        ${ctaHtml ? `
        <div style="display: flex; flex-direction: column; background: ${COLORS.cardBg}; border: 1px solid ${COLORS.border}; border-radius: 12px; padding: 32px;">
          ${createSectionHeader('03 / CALL TO ACTION')}
          <div style="display: flex; flex-direction: column;">
            ${ctaHtml}
          </div>
        </div>` : ''}

        <!-- Attractive Footer -->
        <div style="display: flex; justify-content: center; margin-top: 56px;">
          <div style="display: flex; align-items: center; gap: 16px; opacity: 0.2;">
            <div style="display: flex; height: 1px; width: 40px; background: ${COLORS.textMuted};"></div>
            <div style="display: flex; font-size: 11px; font-weight: 600; color: ${COLORS.textMuted}; letter-spacing: 6px;">PRODUCTION BLUEPRINT V2.5.2 INT-HINT</div>
            <div style="display: flex; height: 1px; width: 40px; background: ${COLORS.textMuted};"></div>
          </div>
        </div>

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
