# Connecting ScriptFlow to ManyChat

This guide explains how to connect your deployed backend to a ManyChat Flow using the **External Request** action.

## Prerequisites
1. Your **Render URL** from the deployment step (e.g., `https://scriptflow-backend.onrender.com`).
2. Two Custom Fields in ManyChat to store user inputs:
   *   User Field: `User_Idea` (Type: Text)
   *   User Field: `User_Reel_Url` (Type: Text)
3. One Custom Field to store the result:
   *   User Field: `AI_Script_Result` (Type: Text)

---

## Step 1: The Flow Setup
1. **Get User Input**: Create a flow that asks the user for their Idea and the Reel URL. Save these into the custom fields mentioned above (`User_Idea` and `User_Reel_Url`).
2. **Action Block**: After collecting inputs, add an **Action** block.

## Step 2: Configure External Request
1. Click on the Action block and select **External Request**.
2. **Request Type**: `POST`
3. **Request URL**: `https://YOUR_RENDER_URL/api/v1/script/generate` (Replace `YOUR_RENDER_URL` with your actual domain).
4. **Headers**:
   *   Key: `Content-Type`
   *   Value: `application/json`

## Step 3: Configure the Body
Click on the **Body** tab and select **Raw JSON**. Paste this exact structure:

```json
{
  "manychat_user_id": "{{id}}",
  "reel_url": "{{User_Reel_Url}}",
  "user_idea": "{{User_Idea}}"
}
```

*Note: `{{id}}` is a system field in ManyChat that automatically sends the user's ID. `{{User_Reel_Url}}` and `{{User_Idea}}` are the custom fields you created.*

## Step 4: Response Mapping (Crucial)
1. In the External Request window, click the **Test Request** button.
   *   *Tip: You might need to temporarily hardcode values in the Body for the test to work if your current user fields are empty.*
   *   *Or, run the flow once to populate your fields, then come back to test.*
2. Once you get a `200 OK` response with the JSON, go to the **Response Mapping** tab.
3. Map the JSON response to your ManyChat field:
   *   **JSON Path**: `$.script`
   *   **Save to Custom Field**: `AI_Script_Result`

## Step 5: Handling Timeouts (Important)
Since video processing takes time (5-15 seconds), ManyChat might timeout (10s limit).

**Ideally**, ensure your backend returns within 10s. If requests consistently timeout:
1. Increase your server power (Render standard tier).
2. Or, tell users "This might take a moment" before the request.

---

## Example Flow Outline

1. **Message**: "Send me an Instagram Reel link!"
   *   Input saved to `{{User_Reel_Url}}`
2. **Message**: "What's your idea for this script?"
   *   Input saved to `{{User_Idea}}`
3. **Message**: "Analyzing... (This takes about 10 seconds) 🤖"
4. **Action**: External Request (Calls your API)
   *   *On Success*: Go to Step 5.
   *   *On Failure*: Message "Something went wrong. Make sure it's a public Reel."
5. **Message**: "Here is your script! 👇"
6. **Message**: `{{AI_Script_Result}}`
