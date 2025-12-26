import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../config';

// SECURITY: Request timeout to prevent hung connections
const API_TIMEOUT_MS = 30000;

export interface ManyChatPayload {
  subscriber_id: string;
  field_name: string;
  field_value: string;
  message_tag?: string;
}

export async function sendToManyChat(payload: ManyChatPayload): Promise<void> {
  // SECURITY: Use validated config object, not direct env access
  const apiKey = config.MANYCHAT_API_KEY;
  
  if (!apiKey) {
    logger.warn('Skipping ManyChat send: No MANYCHAT_API_KEY provided.');
    return;
  }

  try {
    logger.info(`Sending to ManyChat. Subscriber: ${payload.subscriber_id}, Value Length: ${payload.field_value.length}`);

    // 1. Set the Custom Field by ID (Most Reliable)
    // Ensure subscriber_id is an integer if required by the API
    const subscriberIdInt = parseInt(payload.subscriber_id, 10);

    const setFieldUrl = 'https://api.manychat.com/fb/subscriber/setCustomField';
    
    // Use the field ID explicitly from config if available, otherwise fallback to payload name
    const fieldId = config.MANYCHAT_SCRIPT_FIELD_ID || payload.field_name;

    await axios.post(setFieldUrl, {
      subscriber_id: subscriberIdInt,
      field_id: parseInt(fieldId, 10), // Ensure field_id is also an integer
      field_value: payload.field_value
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: API_TIMEOUT_MS
    });

    // 2. Send the image to the user
    // Only send the "Your script is ready" message if we are sending an image URL
    if (payload.field_name === 'script_image_url') {
        const sendContentUrl = 'https://api.manychat.com/fb/sending/sendContent';
        
        await axios.post(sendContentUrl, {
            subscriber_id: payload.subscriber_id,
            data: {
                version: "v2",
                content: {
                    type: "image",
                    url: payload.field_value,
                    action: {
                        type: "open_url",
                        url: payload.field_value
                    }
                }
            },
            message_tag: "NON_PROMOTIONAL_SUBSCRIPTION"
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: API_TIMEOUT_MS
        });
    }

    logger.info(`Successfully sent script to ManyChat user: ${payload.subscriber_id}`);

  } catch (error: any) {
    logger.error('Failed to send to ManyChat', JSON.stringify(error.response?.data || error.message, null, 2));
    // don't throw, just log.
  }
}
