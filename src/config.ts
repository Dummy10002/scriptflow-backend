import { cleanEnv, str, port, url } from 'envalid';
import dotenv from 'dotenv';

dotenv.config();

export const config = cleanEnv(process.env, {
  PORT: port({ default: 3000 }),
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  GEMINI_API_KEY: str({ desc: 'API Key for Google Gemini' }),
  MANYCHAT_API_KEY: str({ desc: 'API Key for ManyChat (Optional in dev)', default: '' }),
  MANYCHAT_SCRIPT_FIELD_ID: str({ desc: 'Field ID for script image URL', default: '' }),
  IMGBB_API_KEY: str({ desc: 'API Key for ImgBB' }),
  PUPPETEER_EXECUTABLE_PATH: str({ desc: 'Path to Chromium', default: '' }),
});
