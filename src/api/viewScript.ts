import { Request, Response } from 'express';
import crypto from 'crypto';
import { Script } from '../db/models';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Generate a short, URL-safe ID (8 chars for better collision resistance)
 * Uses crypto.randomBytes for cryptographically secure randomness
 */
export function generatePublicId(): string {
  // Use 6 bytes = 48 bits of entropy, base64url encoded = 8 chars
  // Collision probability: 1 in 281 trillion for 1M scripts
  return crypto.randomBytes(6).toString('base64url');
}

/**
 * Generate unique publicId with collision check
 * Retries up to 3 times if collision occurs (extremely rare)
 */
export async function generateUniquePublicId(): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const publicId = generatePublicId();
    
    // Check if already exists
    const existing = await Script.findOne({ publicId }).select('_id').lean();
    if (!existing) {
      return publicId;
    }
    
    logger.warn(`PublicId collision detected: ${publicId}, retrying...`);
  }
  
  // Fallback: Use longer ID (12 chars) if collisions persist
  return crypto.randomBytes(9).toString('base64url');
}

/**
 * Build the full public URL for a script
 * Uses config.BASE_URL with fallback to localhost
 */
export function buildScriptUrl(publicId: string): string {
  const baseUrl = config.BASE_URL || `http://localhost:${config.PORT}`;
  return `${baseUrl}/s/${publicId}`;
}

/**
 * GET /s/:publicId - Public script viewing page
 * Returns an HTML page with the script text and a copy button
 * 
 * SECURITY:
 * - Input validation on publicId format
 * - HTML escaping for XSS prevention
 * - noindex, nofollow for privacy
 * - Cache headers for performance
 */
export const viewScriptHandler = async (req: Request, res: Response) => {
  try {
    const { publicId } = req.params;
    
    // SECURITY: Validate publicId format (base64url chars only, 6-12 chars)
    if (!publicId || !/^[A-Za-z0-9_-]{6,12}$/.test(publicId)) {
      return res.status(400).send(generateErrorPage('Invalid script link'));
    }

    const script = await Script.findOne({ publicId }).lean();
    
    if (!script) {
      return res.status(404).send(generateErrorPage('Script not found or expired'));
    }

    // Set cache headers (1 hour - scripts are immutable)
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    
    // SECURITY: X-Content-Type-Options to prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    res.send(generateScriptPage(script.scriptText, script.userIdea));

  } catch (error) {
    logger.error('Failed to view script:', error);
    res.status(500).send(generateErrorPage('Something went wrong'));
  }
};

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate the HTML page for viewing and copying the script
 * Mobile-first, dark theme, one-click copy
 */
function generateScriptPage(scriptText: string, userIdea: string): string {
  const escapedScript = escapeHtml(scriptText);
  const escapedIdea = escapeHtml(userIdea);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Your Script | ScriptFlow</title>
  <meta name="description" content="Your AI-generated video script - tap to copy">
  <meta name="robots" content="noindex, nofollow">
  
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(180deg, #09090b 0%, #18181b 100%);
      color: #fafafa;
      min-height: 100vh;
      padding: 20px;
      padding-bottom: 100px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    
    .logo {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    
    .logo span {
      color: #22d3ee;
    }
    
    .badge {
      font-size: 10px;
      color: #a1a1aa;
      background: rgba(255,255,255,0.05);
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
      letter-spacing: 1px;
    }
    
    .idea {
      font-size: 12px;
      color: #a1a1aa;
      margin-bottom: 20px;
      padding: 12px 16px;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
      border-left: 3px solid #22d3ee;
    }
    
    .idea-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #52525b;
      margin-bottom: 4px;
    }
    
    .script-container {
      background: rgba(24, 24, 27, 0.8);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    
    .script-text {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 13px;
      line-height: 1.8;
      color: #e4e4e7;
      white-space: pre-wrap;
      word-break: break-word;
      user-select: all;
      -webkit-user-select: all;
    }
    
    .copy-button {
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%);
      color: #09090b;
      border: none;
      border-radius: 12px;
      padding: 16px 24px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 10px 30px rgba(34, 211, 238, 0.3);
      transition: all 0.2s ease;
      z-index: 1000;
    }
    
    .copy-button:active {
      transform: scale(0.98);
    }
    
    .copy-button.copied {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      box-shadow: 0 10px 30px rgba(34, 197, 94, 0.3);
    }
    
    .copy-icon {
      width: 20px;
      height: 20px;
    }
    
    .footer {
      text-align: center;
      font-size: 11px;
      color: #52525b;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">SCRIPT<span>FLOW</span></div>
    <div class="badge">COPY READY</div>
  </div>
  
  <div class="idea">
    <div class="idea-label">Your Concept</div>
    ${escapedIdea}
  </div>
  
  <div class="script-container">
    <pre class="script-text" id="scriptText">${escapedScript}</pre>
  </div>
  
  <button class="copy-button" id="copyBtn" onclick="copyScript()">
    <svg class="copy-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
    </svg>
    <span id="copyText">Tap to Copy Script</span>
  </button>
  
  <div class="footer">
    Generated by ScriptFlow AI
  </div>
  
  <script>
    async function copyScript() {
      var scriptText = document.getElementById('scriptText').innerText;
      var btn = document.getElementById('copyBtn');
      var btnText = document.getElementById('copyText');
      
      try {
        await navigator.clipboard.writeText(scriptText);
        btn.classList.add('copied');
        btnText.innerText = '✓ Copied to Clipboard!';
        
        setTimeout(function() {
          btn.classList.remove('copied');
          btnText.innerText = 'Tap to Copy Script';
        }, 2000);
      } catch (err) {
        // Fallback for older browsers
        var textarea = document.createElement('textarea');
        textarea.value = scriptText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
          document.execCommand('copy');
          btn.classList.add('copied');
          btnText.innerText = '✓ Copied!';
          setTimeout(function() {
            btn.classList.remove('copied');
            btnText.innerText = 'Tap to Copy Script';
          }, 2000);
        } catch (e) {
          btnText.innerText = 'Long-press text to copy';
        }
        
        document.body.removeChild(textarea);
      }
    }
  </script>
</body>
</html>`;
}

/**
 * Generate an error page
 * SECURITY: Message is escaped to prevent XSS
 */
function generateErrorPage(message: string): string {
  const escapedMessage = escapeHtml(message);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error | ScriptFlow</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #09090b;
      color: #fafafa;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 20px;
    }
    .error-container {
      max-width: 400px;
    }
    h1 {
      font-size: 48px;
      margin-bottom: 16px;
    }
    p {
      color: #a1a1aa;
      font-size: 16px;
    }
    .logo {
      font-size: 14px;
      color: #52525b;
      margin-top: 32px;
    }
    .logo span { color: #22d3ee; }
  </style>
</head>
<body>
  <div class="error-container">
    <h1>😕</h1>
    <p>${escapedMessage}</p>
    <div class="logo">SCRIPT<span>FLOW</span></div>
  </div>
</body>
</html>`;
}
