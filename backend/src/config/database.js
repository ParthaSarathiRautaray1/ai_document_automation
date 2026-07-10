/**
 * MongoDB connection management (Mongoose).
 *
 * Handles connect/disconnect with sane production options and connection-event
 * logging. `connectDatabase` is awaited during server bootstrap so the process
 * exits if the database is unreachable rather than serving a broken API.
 */
import mongoose from 'mongoose';
import env from './env.js';
import logger from './logger.js';

mongoose.set('strictQuery', true);

let isConnected = false;

export async function connectDatabase(uri = env.MONGODB_URI) {
  if (isConnected) return mongoose.connection;

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error(`MongoDB error: ${err.message}`));
  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('MongoDB disconnected');
  });

  await mongoose.connect(uri, {
    autoIndex: !env.isProduction, // build indexes automatically outside production
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });

  isConnected = true;
  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}
