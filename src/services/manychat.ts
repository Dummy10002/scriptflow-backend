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
  scriptUrl?: string;  // Optional URL for copy-friendly script page
}

export async function sendToManyChat(payload: ManyChatPayload): Promise<void> {
  // SECURITY: Use validated config object, not direct env access
  const apiKey = config.MANYCHAT_API_KEY;
  
  if (!apiKey) {
    logger.warn('Skipping ManyChat send: No MANYCHAT_API_KEY provided.');
    return;
  }

  const subscriberIdInt = parseInt(payload.subscriber_id, 10);
  
  // Validate subscriber_id is a valid number
  if (isNaN(subscriberIdInt)) {
    logger.error(`Invalid subscriber_id: ${payload.subscriber_id}`);
    return;
  }

  try {
    logger.info(`Sending to ManyChat. Subscriber: ${payload.subscriber_id}, Value Length: ${payload.field_value.length}`);

    // 1. Set the Custom Field by ID (Most Reliable)
    const setFieldUrl = 'https://api.manychat.com/fb/subscriber/setCustomField';
    
    // Use the field ID explicitly from config if available, otherwise fallback to payload name
    const fieldId = config.MANYCHAT_SCRIPT_FIELD_ID || payload.field_name;

    await axios.post(setFieldUrl, {
      subscriber_id: subscriberIdInt,
      field_id: parseInt(fieldId, 10),
      field_value: payload.field_value
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: API_TIMEOUT_MS
    });

    // 2. Send the image to the user (if this is an image URL field)
    if (payload.field_name === 'script_image_url') {
      const sendContentUrl = 'https://api.manychat.com/fb/sending/sendContent';
      
      // Send the script image
      try {
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
        
        logger.info(`Image sent successfully to ${payload.subscriber_id}`);
      } catch (imageError: any) {
        // Log but don't fail the whole operation
        logger.error(`Failed to send image: ${imageError.response?.data?.message || imageError.message}`);
      }

      // 3. Send copy-friendly link as a follow-up message (isolated error handling)
      if (payload.scriptUrl) {
        try {
          logger.info(`Sending copy link to ManyChat: ${payload.scriptUrl}`);
          
          await axios.post(sendContentUrl, {
            subscriber_id: payload.subscriber_id,
            data: {
              version: "v2",
              content: {
                messages: [
                  {
                    type: "text",
                    text: `📋 Tap to copy script text:\n${payload.scriptUrl}`
                  }
                ]
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
          
          logger.info(`Copy link sent successfully to ${payload.subscriber_id}`);
        } catch (linkError: any) {
          // Log but don't fail - the image was sent, copy link is optional
          logger.warn(`Failed to send copy link (non-critical): ${linkError.response?.data?.message || linkError.message}`);
        }
      }
    }

    logger.info(`Successfully completed ManyChat send for user: ${payload.subscriber_id}`);

  } catch (error: any) {
    logger.error('Failed to send to ManyChat', JSON.stringify(error.response?.data || error.message, null, 2));
    // Don't throw - ManyChat failures should not break the job
  }
}
