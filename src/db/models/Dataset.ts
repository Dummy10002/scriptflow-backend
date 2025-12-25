import mongoose, { Schema, Document } from 'mongoose';

/**
 * Dataset Entry Interface
 * Comprehensive schema for ML model training data
 * 
 * This schema captures:
 * - Input features: What went into the generation (video metadata, transcript, visual cues)
 * - Output features: What was generated (script structure)
 * - Quality metrics: How good was the output (feedback, ratings)
 * - Metadata: Versioning for reproducibility
 */
export interface IDatasetEntry extends Document {
  // Input features
  input: {
    videoUrl: string;
    userIdea: string;
    transcript?: string;
    visualCues?: string[];
    hookType?: string;
    tone?: string;
    language?: string;
    videoDurationSeconds?: number;
    frameCount?: number;
  };
  // Output features
  output: {
    generatedScript: string;
    scriptStructure?: {
      hookSection?: string;
      bodySection?: string;
      ctaSection?: string;
      visualDirections?: string[];
      dialogueLines?: string[];
    };
    scriptLengthChars: number;
    estimatedSpokenDuration?: number;
  };
  // Quality metrics for training
  metrics: {
    generationTimeMs?: number;
    wasEdited?: boolean;
    userRating?: number;         // 1-5 stars if user provides
    feedbackText?: string;       // Free text feedback
    wasUsedInVideo?: boolean;    // If we can track this
    engagementScore?: number;    // If user shares video stats
  };
  // Metadata for ML training
  modelVersion: string;
  datasetVersion: string;
  isValidated: boolean;          // Human reviewed for quality
  includedInTraining: boolean;   // Actually used in training
  createdAt: Date;
}

const DatasetEntrySchema = new Schema<IDatasetEntry>({
  input: {
    videoUrl: { type: String, required: true },
    userIdea: { type: String, required: true },
    transcript: String,
    visualCues: [String],
    hookType: String,
    tone: String,
    language: String,
    videoDurationSeconds: Number,
    frameCount: Number
  },
  output: {
    generatedScript: { type: String, required: true },
    scriptStructure: {
      hookSection: String,
      bodySection: String,
      ctaSection: String,
      visualDirections: [String],
      dialogueLines: [String]
    },
    scriptLengthChars: { type: Number, required: true },
    estimatedSpokenDuration: Number
  },
  metrics: {
    generationTimeMs: Number,
    wasEdited: { type: Boolean, default: false },
    userRating: { type: Number, min: 1, max: 5 },
    feedbackText: String,
    wasUsedInVideo: Boolean,
    engagementScore: Number
  },
  modelVersion: { 
    type: String, 
    required: true,
    default: 'gemini-2.5-flash'
  },
  datasetVersion: { 
    type: String, 
    default: '1.0.0' 
  },
  isValidated: { 
    type: Boolean, 
    default: false 
  },
  includedInTraining: { 
    type: Boolean, 
    default: false 
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Index for dataset queries
DatasetEntrySchema.index({ isValidated: 1, includedInTraining: 1 });
DatasetEntrySchema.index({ 'metrics.userRating': 1 });
DatasetEntrySchema.index({ modelVersion: 1, datasetVersion: 1 });
DatasetEntrySchema.index({ createdAt: -1 });

export const DatasetEntry = mongoose.model<IDatasetEntry>('DatasetEntry', DatasetEntrySchema);
