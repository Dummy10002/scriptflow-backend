
import mongoose, { Schema, Document } from 'mongoose';

export interface IScript extends Document {
  originalInput: {
    reelUrl: string;
    userIdea: string;
    videoMetadata?: any;
  };
  aiGeneration: {
    promptUsed: string;
    modelUsed: string;
    rawOutput: string;
  };
  finalOutput: {
    scriptText: string;
  };
  feedback: {
    userRating?: number;
    wasEdited?: boolean;
  };
  meta: {
    manychatUserId: string;
    requestHash: string;
    ipAddress?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ScriptSchema = new Schema({
  originalInput: {
    reelUrl: { type: String, required: true },
    userIdea: { type: String, required: true },
    videoMetadata: { type: Schema.Types.Mixed }
  },
  aiGeneration: {
    promptUsed: { type: String, required: true },
    modelUsed: { type: String, required: true },
    rawOutput: { type: String, required: true }
  },
  finalOutput: {
    scriptText: { type: String, required: true }
  },
  feedback: {
    userRating: { type: Number, min: 1, max: 5 },
    wasEdited: { type: Boolean, default: false }
  },
  meta: {
    manychatUserId: { type: String, required: true },
    requestHash: { type: String, required: true, unique: true },
    ipAddress: { type: String }
  }
}, { timestamps: true });

export const Script = mongoose.model<IScript>('Script', ScriptSchema);
