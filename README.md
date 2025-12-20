# ScriptFlow Backend

AI Backend for generating scripts from Instagram Reels, integrated with ManyChat.

## Tech Stack
- Node.js (Express)
- TypeScript
- SQLite
- yt-dlp & FFmpeg
- Gemini 1.5 Flash (STT + Generation)

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file:
   ```env
   PORT=3000
   GEMINI_API_KEY=your_gemini_key
   ```

3. **Run Locally**
   ```bash
   npm run dev
   ```

4. **Docker**
   ```bash
   docker build -t scriptflow .
   docker run -p 3000:3000 -v $(pwd)/temp:/app/temp --env-file .env scriptflow
   ```

## endpoints

### POST /api/v1/script/generate

Body:
```json
{
  "manychat_user_id": "12345",
  "reel_url": "https://www.instagram.com/reel/xyz/",
  "user_idea": "Make it about coding"
}
```
