# Deploying ScriptFlow to Render

Since this backend requires system-level dependencies (`yt-dlp` and `ffmpeg`) that are not available in standard Node.js environments, we will deploy using **Docker**.

## Prerequisites
1. Push this code to a **GitHub** or **GitLab** repository.
2. Have a [Render.com](https://render.com) account.
3. Have your `GEMINI_API_KEY` ready.

---

## Step 1: Create a New Web Service
1. Log in to your Render Dashboard.
2. Click **New +** and select **Web Service**.
3. Connect your GitHub/GitLab account and select the repository you just pushed (`scriptflow-backend`).

## Step 2: Configure the Service
Render will detect the `Dockerfile` automatically. Use these settings:

*   **Name**: `scriptflow-backend` (or whatever you like)
*   **Region**: Closest to you (e.g., Oregon, Frankfurt)
*   **Runtime**: **Docker** (This is critical!)
*   **Instance Type**: **Free** (This works for low volume, but standard is recommended for faster video processing).

## Step 3: Environment Variables
Scroll down to the **Environment Variables** section and add:

| Key | Value |
| :--- | :--- |
| `GEMINI_API_KEY` | `Your_Actual_Gemini_API_Key_Here` |
| `PORT` | `3000` |

## Step 4: Deploy
1. Click **Create Web Service**.
2. Render will start building the Docker image. This might take 5-10 minutes because it needs to install FFmpeg and Python.
3. Once completed, you will see a green **"Live"** badge and a URL (e.g., `https://scriptflow-backend.onrender.com`).

**Copy this URL. You will need it for ManyChat.**

---

## Step 5: How to Test (Before ManyChat)

You can test the live server using `curl` (Terminal) or a tool like Postman.

### Using Curl
Replace `YOUR_RENDER_URL` with the URL you copied above.

```bash
curl -X POST https://YOUR_RENDER_URL/api/v1/script/generate \
  -H "Content-Type: application/json" \
  -d '{
    "manychat_user_id": "test_user_1",
    "reel_url": "https://www.instagram.com/reel/Cm4gXy...",
    "user_idea": "Focus on the coding tips in this video"
  }'
```

### Expected Response
```json
{
  "status": "success",
  "script": "HOOK\nHere is the hook...\n\nBODY\nHere is the body...\n\nCTA\nFollow for more!"
}
```

### Troubleshooting
*   **504 Gateway Timeout**: The video was too long or the server is too slow (Free tier limitation). Try a shorter Reel.
*   **500 Error**: Check the **Logs** tab in Render to see if `yt-dlp` failed or if the API Key is invalid.
