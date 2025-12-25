import axios from 'axios';
import FormData from 'form-data';
import { logger } from './logger';
import { config } from '../config';
import { getBrowser } from '../services/browser';
import { Readable } from 'stream';

const IMGBB_API_KEY = config.IMGBB_API_KEY;

export async function generateScriptImage(scriptText: string): Promise<string> {
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // Parse Script Sections
    let hook = '', body = '', cta = '';
    
    // Simple parsing strategy: Split by headers
    const parts = scriptText.split(/\[(HOOK|BODY|CTA)\]/i);
    // parts[0] might be empty or preamble
    // parts[1] is header name, parts[2] is content, etc.
    
    // Default fallback if structure is missing
    hook = scriptText; 

    for (let i = 1; i < parts.length; i += 2) {
        const header = parts[i].toUpperCase();
        const content = parts[i+1]?.trim() || '';
        
        if (header === 'HOOK') hook = content;
        else if (header === 'BODY') body = content;
        else if (header === 'CTA') cta = content;
    }

    // Set content with premium layout
    await page.setContent(`
        <html>
          <head>
            <link href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,400&display=swap" rel="stylesheet">
            <style>
              body {
                width: 1080px;
                padding: 80px;
                font-family: 'Satoshi', sans-serif;
                background: #F8F9FA;
                color: #111;
                display: flex;
                flex-direction: column;
                gap: 40px;
              }
              .hook-container {
                border-left: 8px solid #000;
                padding-left: 32px;
                margin-bottom: 20px;
              }
              .hook {
                font-size: 36px;
                font-weight: 800; /* Black/Bold */
                line-height: 1.3;
                color: #000;
                white-space: pre-wrap;
              }
              .body {
                font-size: 26px;
                font-weight: 500; /* Regular/Medium */
                line-height: 1.6;
                color: #333;
                white-space: pre-wrap;
              }
              .cta-container {
                margin-top: 20px;
                background: #EAECEF;
                padding: 30px;
                border-radius: 16px;
                text-align: center;
              }
              .cta {
                font-size: 28px;
                font-weight: 800;
                color: #000;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
            </style>
          </head>
          <body>
            
            ${hook ? `
            <div class="hook-container">
              <div class="hook">${hook}</div>
            </div>` : ''}

            ${body ? `
            <div class="body">
${body}
            </div>` : ''}

            ${cta ? `
            <div class="cta-container">
              <div class="cta">${cta}</div>
            </div>` : ''}

            ${!body && !cta ? `<div class="body">${scriptText}</div>` : ''}

          </body>
        </html>
    `);

    // Dynamic viewport height
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewport({ width: 1080, height: bodyHeight });

    // Screenshot
    const imageScreenshot = await page.screenshot({ fullPage: true, encoding: 'binary' });
    const imageBuffer = Buffer.from(imageScreenshot);
    
    logger.info('Image generated successfully, uploading to ImgBB...');
    logger.info(`Image buffer size: ${imageBuffer.length}, isBuffer: ${Buffer.isBuffer(imageBuffer)}`);

    const formData = new FormData();
    // Wrap in Readable stream to satisfy form-data/combined-stream requirements preventing "source.on" error
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
