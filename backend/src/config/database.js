/**
 * MongoDB connection management (Mongoose).
 *
 * Handles connect/disconnect with sane production options and connection-event
 * logging. `connectDatabase` is awaited during server bootstrap so the process
 * exits if the database is unreachable rather than serving a broken API.
 */
import mongoose from 'mongoose';
import dns from 'dns';
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

  // Workaround: Node's built-in DNS resolver (c-ares) can fail SRV lookups
  // on some Windows setups / corporate DNS configurations. If using an
  // SRV connection string, prefer explicitly setting resolvers before the
  // driver triggers SRV queries. This mirrors the common Atlas troubleshooting
  // advice and can be removed if your environment's DNS works correctly.
  try {
    if (typeof uri === 'string' && uri.startsWith('mongodb+srv://')) {
      dns.setServers(['8.8.8.8']);
      logger.info('Set DNS server to 8.8.8.8 for SRV resolution');
    }
  } catch (err) {
    logger.warn(`Failed to set DNS servers: ${err.message}`);
  }

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
