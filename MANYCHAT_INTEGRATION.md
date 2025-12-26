# ManyChat Integration Manual - ScriptFlow v2.5

## Overview

This guide covers how to set up ManyChat for ScriptFlow, including the **new copy-friendly script link feature**.

---

## 🔧 Required Setup

### 1. Get Your ManyChat API Key

1. Go to **ManyChat** → **Settings** → **API**
2. Copy your **API Key**
3. Add it to your `.env` file:
   ```env
   MANYCHAT_API_KEY=your_api_key_here
   ```

### 2. Create Custom Fields

You need **one custom field** to store the script image URL.

1. Go to **Settings** → **Custom Fields**
2. Click **+ New Field**
3. Create this field:

| Field Name | Type | Description |
|------------|------|-------------|
| `script_image_url` | Text | Stores the generated script image URL |

4. Copy the **Field ID** (shown in URL or field settings)
5. Add it to your `.env` file:
   ```env
   MANYCHAT_SCRIPT_FIELD_ID=12345678
   ```

### 3. Set Your Base URL (NEW - Required for Copy Feature)

The copy-friendly link feature requires your production URL:

```env
BASE_URL=https://your-app.onrender.com
```

**Example URLs by platform:**
- Render: `https://scriptflow-backend.onrender.com`
- Railway: `https://scriptflow.up.railway.app`
- Local dev: `http://localhost:3000`

---

## 📱 Flow Configuration

### Basic Flow Structure

```
User sends Reel URL
    ↓
[Trigger: User Input]
    ↓
[Action: Set Custom Field] → Set "user_reel_url"
    ↓
[Action: External Request] → POST to ScriptFlow API
    ↓
[Action: Send Text] → "Analyzing your reel... Please wait!"
    ↓
(Backend sends image + link automatically)
```

---

## 🔌 API Integration

### Endpoint

```
POST https://your-app.onrender.com/api/v1/script/generate
```

### Headers

| Header | Value |
|--------|-------|
| Content-Type | application/json |

### Request Body

```json
{
  "subscriber_id": "{{subscriber_id}}",
  "reel_url": "{{user_reel_url}}",
  "user_idea": "{{user_idea}}"
}
```

### ManyChat Dynamic Variables

| Variable | Source |
|----------|--------|
| `{{subscriber_id}}` | System field (automatic) |
| `{{user_reel_url}}` | Custom field you create |
| `{{user_idea}}` | Custom field (optional) |

---

## 🎯 ManyChat Action Setup

### Step 1: Create the Trigger

1. **Automation** → **New Flow**
2. Add **Keyword Trigger** (e.g., "script", "analyze", "reel")
3. Or use **User Input** to collect the reel URL

### Step 2: Configure User Input

```
[Text] "Send me the Instagram Reel URL and I'll create a script for you!"

[User Input]
  - Variable: user_reel_url
  - Validation: Text (contains "instagram.com/reel")
```

### Step 3: API Request

1. Add **External Request** action
2. Configure:

| Setting | Value |
|---------|-------|
| Method | POST |
| URL | `https://your-app.onrender.com/api/v1/script/generate` |
| Headers | `Content-Type: application/json` |
| Body | See JSON below |

**Body (Raw JSON):**
```json
{
  "subscriber_id": "{{subscriber_id}}",
  "reel_url": "{{user_reel_url}}",
  "user_idea": "{{user_idea}}"
}
```

### Step 4: Immediate Response

After the API request, send acknowledgment:

```
[Text] "🎬 Analyzing your reel... I'll send your script in a moment!"
```

---

## 📤 What Gets Sent to User

After processing, ScriptFlow automatically sends **TWO messages**:

### Message 1: Script Image
```
📸 [Beautiful formatted script image]
```

### Message 2: Copy Link (NEW!)
```
📋 Tap to copy script text:
https://your-app.onrender.com/s/XyZ123
```

**User clicks the link → Mobile-friendly page with one-tap copy!**

---

## 🎨 Optional: Tone & Language Hints

You can customize script generation with optional parameters:

### Tone Hint
```json
{
  "subscriber_id": "{{subscriber_id}}",
  "reel_url": "{{user_reel_url}}",
  "user_idea": "{{user_idea}}",
  "tone_hint": "funny"
}
```

**Available tones:**
- `professional`
- `funny`
- `provocative`
- `educational`
- `casual`

### Language Hint
```json
{
  "subscriber_id": "{{subscriber_id}}",
  "reel_url": "{{user_reel_url}}",
  "user_idea": "{{user_idea}}",
  "language_hint": "Hindi-English mix"
}
```

### Hook Only Mode
```json
{
  "subscriber_id": "{{subscriber_id}}",
  "reel_url": "{{user_reel_url}}",
  "user_idea": "{{user_idea}}",
  "mode": "hook_only"
}
```

---

## ⚡ Quick Keyword Responses

Set up keyword triggers for common requests:

| User Says | API Parameters |
|-----------|----------------|
| "analyze this reel funny" | `tone_hint: "funny"` |
| "analyze this reel hindi" | `language_hint: "Hindi-English mix"` |
| "just the hook" | `mode: "hook_only"` |

---

## 🚨 Troubleshooting

### "Script image not showing"

1. Check Field ID is correct in `.env`
2. Verify API key has correct permissions
3. Check logs: `docker logs scriptflow-backend`

### "Copy link not working"

1. Ensure `BASE_URL` is set in `.env`
2. Verify the URL is publicly accessible
3. Check if script was saved (MongoDB)

### "Request timeout"

The script generation is async. ManyChat should NOT wait for response.
Set timeout in External Request to **30 seconds** max.

### "User not receiving messages"

1. Check if user is within 24-hour messaging window
2. Verify `message_tag: "NON_PROMOTIONAL_SUBSCRIPTION"` is being used
3. Check ManyChat API rate limits

---

## 🔒 Security Notes

1. **Never expose API keys** in ManyChat flows
2. **Rate limiting** is enforced (10 requests/hour per user)
3. **Beta access control** limits to first 100 users
4. **Script links expire** when database is cleared (not time-based)

---

## 📊 Testing Checklist

- [ ] Send test reel URL → Receive script image
- [ ] Click copy link → Page loads on mobile
- [ ] Tap "Copy" button → Text copied successfully
- [ ] Test with tone_hint → Tone applied
- [ ] Test with language_hint → Language applied
- [ ] Test rate limiting → 11th request blocked

---

## 🆘 Support

For issues, check:
1. Backend logs: `docker logs scriptflow-backend`
2. MongoDB: Check `scripts` collection for saved data
3. ManyChat: Review flow execution history

---

**Version:** 2.5.0 - Copy-Friendly Links  
**Last Updated:** December 2024
