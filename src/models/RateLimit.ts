
import mongoose, { Schema, Document } from 'mongoose';

export interface IRateLimit extends Document {
  ip: string;
  count: number;
  windowStart: Date;
  createdAt: Date; 
}

const RateLimitSchema = new Schema({
  ip: { type: String, required: true, unique: true },
  count: { type: Number, default: 1 },
  windowStart: { type: Date, default: Date.now },
  // TTL Index: Expires documents after 15 minutes (900 seconds)
  // Note: The expiry works based on the 'createdAt' field or a specific date field.
  // We'll set it on windowStart to be safe, or we can rely on createdAt if we create a new doc per window.
  // Strategy: We update 'windowStart' on reset. 
  // Easier Strategy for TTL: Let the document expire after 15m of inactivity or creation?
  // Common Rate Limit Pattern in Mongo: 
  // Fixed Window: Reset at specific times. 
  // Sliding Window (TTL): Expire record if not updated? 
  // Let's stick to the plan: Expiration after 15 mins.
  createdAt: { type: Date, default: Date.now, expires: 900 } 
});

export const RateLimit = mongoose.model<IRateLimit>('RateLimit', RateLimitSchema);
