# Async Analysis Flow Guide (Option B)

This backend runs in a "Fire-and-Forget" mode to support deep video analysis without hitting ManyChat's 10-second timeout.

## How it Works
1. **Request:** ManyChat sends `POST /api/v1/script/generate`.
2. **Ack:** Backend sends immediate JSON `{ status: "queued" }`.
3. **Analyze:** Backend downloads, transcribes, and generates script (takes 30-60s).
4. **Push:** Backend calls ManyChat API to update the User Field `AI_Script_Result`.

## Configuration Required
You MUST add the following to your `.env` file:

```env
GEMINI_API_KEY=your_gemini_key
MANYCHAT_API_KEY=your_manychat_token_here
```

### How to get ManyChat API Key:
1. Go to ManyChat > Settings > API.
2. Click "Generate Token".
3. Copy the token.

## ManyChat Flow Setup
1. **External Request Node:**
   - URL: `https://your-server.com/api/v1/script/generate`
   - Maps `$.script` (Optional: we now ignore this mostly, but keep it for cache hits).
   
2. **Wait Logic (IMPORTANT):**
   - After the External Request, add a **"Condition"** step? NO.
   - Using this Async flow, the External Request keeps the flow moving immediately.
   - You should just show a message: "I'm watching the reel now... give me a minute."
   
3. **Receiving the Result:**
   - The Backend will update the Custom Field `AI_Script_Result`.
   - You need a **Rule** (Automation > Rules) or just let the backend send the message (Current code sends a text message directly!).
   - **Current Code Behavior:** The backend sends a generic text message "✅ Your script is ready!" followed by the Script text bubble.

## Reliability
- If download fails, the backend sends a "Fallback Script" via the same API method.
- The user ALWAYS gets a result eventually.
