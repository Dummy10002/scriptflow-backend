# Deploy & Test Guide (Docker + Redis Edition)

This guide covers how to deploy the **Full Stack** application (Web + Worker + Database + Queue) using Docker.

## Prerequisites
1.  **System**: Docker and Docker Compose installed.
2.  **API Keys**: Google Gemini API Key, ImgBB API Key, API Secret Key (Generic).

---

## Part 1: Local Testing (The "One-Command" Way)

We use `docker-compose` to run the entire backend locally.

### 1. Setup Environment
Create a `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=development
# Keys
GEMINI_API_KEY=your_gemini_key
IMGBB_API_KEY=your_img_bb_key
MANYCHAT_API_KEY=optional_locally
API_SECRET_KEY=mySuperSecretKey123
# Connections (Docker Internal Hostnames)
MONGO_URI=mongodb://mongo:27017/scriptflow
REDIS_URL=redis://redis:6379
```

### 2. Start the System
Open your terminal and run:
```bash
docker-compose up --build
```
You will see 3 services starting: `app`, `mongo`, and `redis`.

### 3. Send a Test Request (Verified)
Open another terminal window (or Postman) and run:

```bash
curl -X POST http://localhost:3000/api/v1/script/generate \
  -H "Content-Type: application/json" \
  -H "x-api-key: mySuperSecretKey123" \
  -d '{
    "subscriber_id": "test_user_1",
    "reel_url": "https://www.instagram.com/reel/Cm4gExample...",
    "user_idea": "Make this funny"
  }'
```
**Expected Response**:
```json
{
  "status": "queued",
  "message": "Analyzing your reel... I will send the script in a new message shortly!"
}
```

---

## Part 2: Deployment on Render

To deploy this architecture on Render, we need 3 services:
1.  **Web Service (Docker)**: The Node.js App.
2.  **Redis (Instance)**: The Queue.
3.  **MongoDB (Instance)**: The Database.

### Step 1: Create Redis
1.  New -> **Redis**.
2.  Name: `scriptflow-redis`.
3.  Copy the **Internal Connection URL** (e.g., `redis://red-c...:6379`).

### Step 2: Create MongoDB (Atlas or Render)
1.  If using **MongoDB Atlas**, get your connection string.
2.  If mostly testing, you can try Render's managed PostgreSQL (not Mongo) or spin up a Mongo Docker, but Atlas Free Tier is best for Mongo.

### Step 3: Create Web Service
1.  New -> **Web Service**.
2.  Connect Repo -> Select `scriptflow-backend`.
3.  Runtime: **Docker**.
4.  **Environment Variables**:
    *   `GEMINI_API_KEY`: ...
    *   `IMGBB_API_KEY`: ...
    *   `API_SECRET_KEY`: (Create a strong password)
    *   `REDIS_URL`: (Paste from Step 1)
    *   `MONGO_URI`: (Paste from Step 2)
    *   `PUPPETEER_EXECUTABLE_PATH`: `/usr/bin/chromium` (Already preset in Dockerfile but good to confirm)

### Step 4: Verify
1.  Deploy.
2.  Check Logs. You should see "Connected to MongoDB" and "Script Generation Queue initialized".
