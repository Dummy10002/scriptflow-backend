import axios from 'axios';
import { logger } from '../utils/logger';

export interface ManyChatPayload {
  subscriber_id: string; // Will be converted to integer
  field_value: string;   // Image URL
}

export async function sendToManyChat(payload: ManyChatPayload): Promise<void> {
  const apiKey = process.env.MANYCHAT_API_KEY;
  const fieldIdEnv = process.env.MANYCHAT_SCRIPT_FIELD_ID;
  
  if (!apiKey || !fieldIdEnv) {
    logger.warn('Skipping ManyChat send: Missing MANYCHAT_API_KEY or MANYCHAT_SCRIPT_FIELD_ID.');
    return;
  }

  try {
    const subscriberIdInt = parseInt(payload.subscriber_id, 10);
    const fieldIdInt = parseInt(fieldIdEnv, 10);

    const setFieldUrl = 'https://api.manychat.com/fb/subscriber/setCustomField';

    const body = {
      subscriber_id: subscriberIdInt,
      field_id: fieldIdInt,
      field_value: payload.field_value
    };

    await axios.post(setFieldUrl, body, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`Successfully sent script image URL to ManyChat user: ${payload.subscriber_id}`);

  } catch (error: any) {
    logger.error('Failed to send to ManyChat', JSON.stringify(error.response?.data || error.message, null, 2));
  }
}
