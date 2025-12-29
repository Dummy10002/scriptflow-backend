# ManyChat Setup Guide

This guide details the specific configuration required inside ManyChat to integrate with ScriptFlow.

## 1. Get Your API Key
1. Go to **Settings** -> **API**.
2. Click **Generate Your Token**.
3. Copy this token. This goes into your `.env` as `MANYCHAT_API_KEY`.

## 2. Create Custom User Fields
You need to create User Fields to store the outputs from ScriptFlow so you can use them in your flows.

1. Go to **Settings** -> **Definitions** -> **User Fields**.
2. Click **+ New User Field**.
3. Create the following fields:

| Field Label | Type | Description |
|-------------|------|-------------|
| `Script Image URL` | **Text** | Stores the URL of the generated script image. |
| `Script Copy Link` | **Text** | Stores the URL for the copy-friendly page. |

4. After creating them, look for the **Field ID** (It's usually a number like `1234567`). Use the ID for `Script Image URL` as `MANYCHAT_SCRIPT_FIELD_ID` and the ID for `Script Copy Link` as `MANYCHAT_COPY_FIELD_ID` in your `.env`.

## 3. Create the Flow
1. Create a new flow.
2. **Starting Step**: A Trigger (e.g., Keyword "analyze") or User Input.
3. **Collect Input**: Ask the user for the Instagram Reel URL. Save this to a Custom User Field called `user_reel_url` (Text).

## 4. External Request Step
Add an **Action** step and select **External Request**.

- **Request Type**: POST
- **Request URL**: `[YOUR_BASE_URL]/api/v1/script/generate`
  - Example: `https://your-app.onrender.com/api/v1/script/generate`
- **Headers**:
  - `Content-Type`: `application/json`
  - `x-api-key`: (Optional check if you implemented API authentication mostly for admin, usually not needed if using ManyChat's signature, but standard setup here avoids it for public endpoint) -> *Actually, just Content-Type is sufficient for the public endpoint.*

- **Body**:
  ```json
  {
    "subscriber_id": "{{id}}",
    "reel_url": "{{user_reel_url}}",
    "user_idea": "Optional idea if you collected it",
    "tone_hint": "Optional tone",
    "language_hint": "Optional language"
  }
  ```
  *(Note: Replace `{{id}}` and `{{user_reel_url}}` with the actual variable pickers in ManyChat)*

- **Response Mapping (Optional)**:
  - If your endpoint returns synchronous data you can map it here. However, ScriptFlow is usually asynchronous. It will trigger a separate update by setting the Custom Fields you defined in Step 2.

## 5. Handling the Result
Since the process is asynchronous (takes ~30-60s):
1. The External Request sends the job to the backend.
2. Send a message to the user: "Processing your reel! I'll send the script shortly..."
3. The Backend will automatically update the `Script Image URL` and `Script Copy Link` fields for that user when done.
4. If `MANYCHAT_ENABLE_DIRECT_MESSAGING` is `true`, the backend might also trigger a flow or send a text directly.
5. Alternatively, you can have a "Check Status" button or a Rule that triggers when the Custom Field `Script Image URL` is updated.
