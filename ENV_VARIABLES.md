# Environment Variables Reference

This document lists all environment variables required to configure the ScriptFlow backend.

## 📌 Server Configuration

| Variable | Description | Default | Required? |
|----------|-------------|---------|-----------|
| `PORT` | Port for the server to listen on. | `3000` | No |
| `NODE_ENV` | Environment mode (`development`, `test`, `production`). | `development` | No |
| `BASE_URL` | Public URL of your deployed app (e.g., `https://yourapp.onrender.com`). Used for ensuring copy-friendly links work correctly. | `""` | **YES** (for production) |

## 🗄️ Database & Storage

| Variable | Description | Example | Required? |
|----------|-------------|---------|-----------|
| `MONGODB_URI` | Connection string for MongoDB. | `mongodb+srv://user:pass@...` | **YES** |
| `REDIS_URL` | Connection URL for Redis (used for queues & rate limiting). | `redis://localhost:6379` | **YES** |

## 🧠 AI Services

| Variable | Description | Required? |
|----------|-------------|-----------|
| `GEMINI_API_KEY` | API Key for Google Gemini (AI Studio). | **YES** |

## 💬 ManyChat Configuration

| Variable | Description | Required? |
|----------|-------------|-----------|
| `MANYCHAT_API_KEY` | API Key from ManyChat Settings. | **YES** |
| `MANYCHAT_SCRIPT_FIELD_ID` | Field ID to store the generated **Script Image URL**. | **YES** |
| `MANYCHAT_COPY_FIELD_ID` | Field ID to store the **Copy Link URL**. | **YES** |
| `MANYCHAT_ENABLE_DIRECT_MESSAGING`| Set to `true` to enable direct sending of messages (optional feature). | No (Default: `false`) |

## 🖼️ Image & Media Services

| Variable | Description | Required? |
|----------|-------------|-----------|
| `IMGBB_API_KEY` | API Key for ImgBB (used to host generated images). | **YES** |
| `FFMPEG_PATH` | Path to FFmpeg executable. | No |
| `FFPROBE_PATH` | Path to FFprobe executable. | No |
| `ANALYSIS_MODE` | Mode for video analysis: `audio`, `frames`, or `hybrid`. | No (Default: `hybrid`) |

## 🛡️ Security & Limits

| Variable | Description | Default | Required? |
|----------|-------------|---------|-----------|
| `ADMIN_API_KEY` | Secret key to protect admin-only endpoints. | `""` | No |
| `QUEUE_CONCURRENCY` | Number of concurrent job workers. | `5` | No |
| `RATE_LIMIT_MAX` | Max requests per 15 minutes (IP-based). | `100` | No |
| `USER_RATE_LIMIT` | Max requests per hour per subscriber. | `10` | No |
| `MAX_BETA_USERS` | Max allowed active beta users. | `100` | No |
