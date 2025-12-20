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
    const url = 'https://api.manychat.com/fb/subscriber/setCustomField';
    
    // 1. Set the Custom Field (Result)
    await axios.post(url, {
      subscriber_id: payload.subscriber_id,
      field_id: payload.field_name, // You might need field_id or field_name depending on API version, usually field_id is safer but name works in some endpoints. 
      // Actually, standard ManyChat API uses field_id or field_name.
      // Better to use setCustomFieldByName if using name.
      field_value: payload.field_value
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // 2. Trigger the "Flow" (Optional but recommended to notify user)
    // Or simpler: The backend sets the Custom Field, and ManyChat has a "Rule" that triggers when that field changes.
    // For this PRD, we'll assume setting the field is the primary delivery mechanism.
    
    // However, to make it "Active", we usually send a Flow or a Text message. 
    // Let's stick to just setting the field for now as per "Map $.script" in PRD. 
    // BUT since it's async, we likely need to trigger a "Flow" to actually show the message.
    
    // Let's assume we just set the field, and the user has a "Check" generic flow or we use the "sendContent" API.
    
    // Let's send a text message notifying the user.
    await axios.post('https://api.manychat.com/fb/sending/sendContent', {
      subscriber_id: payload.subscriber_id,
      data: {
        version: "v2",
        content: {
          type: "text",
          text: "✅ Your script is ready! Check it out below:"
        }
      }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Then send the script as a separate bubble or just rely on the field. 
    // Actually, sending the script directly in a message is better for Async.
    
    await axios.post('https://api.manychat.com/fb/sending/sendContent', {
      subscriber_id: payload.subscriber_id,
      data: {
        version: "v2",
        content: {
          type: "text",
          text: payload.field_value // The Script
        }
      }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`Successfully sent script to ManyChat user: ${payload.subscriber_id}`);

  } catch (error: any) {
    logger.error('Failed to send to ManyChat', JSON.stringify(error.response?.data || error.message, null, 2));
    // don't throw, just log.
  }
}
