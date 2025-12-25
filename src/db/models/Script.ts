import mongoose, { Schema, Document } from 'mongoose';

/**
 * Script Document Interface
 * Stores generated scripts with metadata for caching and ML training
 */
export interface IScript extends Document {
  requestHash: string;
  manychatUserId: string;
  reelUrl: string;
  userIdea: string;
  scriptText: string;
  imageUrl?: string;        // Generated script image URL
  // ML-relevant metadata
  modelVersion?: string;
  generationTimeMs?: number;
  feedbackScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ScriptSchema = new Schema<IScript>({
  requestHash: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  manychatUserId: { 
    type: String, 
    required: true, 
    index: true 
  },
  reelUrl: { 
    type: String, 
    required: true 
  },
  userIdea: { 
    type: String, 
    required: true 
  },
  scriptText: { 
    type: String, 
    required: true 
  },
  imageUrl: {
    type: String
  },
  modelVersion: { 
    type: String, 
    default: 'gemini-2.5-flash' 
  },
  generationTimeMs: { 
    type: Number 
  },
  feedbackScore: { 
    type: Number, 
    min: 1, 
    max: 5 
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Index for idempotency check (most common query)
ScriptSchema.index({ requestHash: 1 });

// Index for user history queries
ScriptSchema.index({ manychatUserId: 1, createdAt: -1 });

export const Script = mongoose.model<IScript>('Script', ScriptSchema);
