import axios from 'axios';
import { logger } from '../utils/logger';

export interface ManyChatPayload {
  subscriber_id: string;
  field_name: string;
  field_value: string;
  message_tag?: string;
}

export async function sendToManyChat(payload: ManyChatPayload): Promise<void> {
  const apiKey = process.env.MANYCHAT_API_KEY;
  
  if (!apiKey) {
    logger.warn('Skipping ManyChat send: No MANYCHAT_API_KEY provided.');
    return;
  }

  try {
    const setFieldUrl = 'https://api.manychat.com/fb/subscriber/setCustomFieldByName';
    
    // 1. Set the Custom Field (Result)
    await axios.post(setFieldUrl, {
      subscriber_id: payload.subscriber_id,
      field_name: payload.field_name,
      field_value: payload.field_value
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
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
            }
        });
    }

    logger.info(`Successfully sent script to ManyChat user: ${payload.subscriber_id}`);

  } catch (error: any) {
    logger.error('Failed to send to ManyChat', JSON.stringify(error.response?.data || error.message, null, 2));
    // don't throw, just log.
  }
}
