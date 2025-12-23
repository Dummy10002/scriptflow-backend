
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { config } from '../config';

export const connectDB = async () => {
  try {
    if (!config.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }
    
    await mongoose.connect(config.MONGO_URI);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};
