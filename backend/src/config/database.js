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

  // Node's DNS resolver (c-ares) can fail SRV lookups on some Windows/corporate
  // DNS setups. Opt in with DB_SRV_DNS_SERVERS when that bites — this used to be
  // a hardcoded public resolver, which silently breaks private-zone (VPC) DNS in
  // a deployed container, so it is now explicit and off by default.
  try {
    if (typeof uri === 'string' && uri.startsWith('mongodb+srv://') && env.dbSrvDnsServers.length) {
      dns.setServers([...env.dbSrvDnsServers]);
      logger.info(`Using DNS servers ${env.dbSrvDnsServers.join(', ')} for SRV resolution`);
    }
  } catch (err) {
    logger.warn(`Failed to set DNS servers: ${err.message}`);
  }

  await mongoose.connect(uri, {
    // Never let production block on implicit index builds during a query...
    autoIndex: !env.isProduction,
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });

  isConnected = true;
  return mongoose.connection;
}

/**
 * Reconcile every registered model's declared indexes with the database.
 *
 * ...but with `autoIndex` off, production would otherwise NEVER create them —
 * and several correctness invariants are enforced *by* indexes (unique email and
 * org slug, the per-org unique SKU, one pending approval per document, one
 * version number per document). So the bootstrap calls this explicitly, where a
 * failure is visible at deploy time instead of surfacing as a silent duplicate.
 *
 * `syncIndexes()` also drops indexes the models no longer declare, keeping a
 * long-lived deployment in step with the schema.
 *
 * @returns {Promise<string[]>} names of the models that were synced
 */
export async function syncIndexes() {
  const modelNames = mongoose.modelNames();
  for (const name of modelNames) {
    // Sequential on purpose: index builds are I/O heavy and this runs once, at
    // boot, before the server accepts traffic.
    await mongoose.model(name).syncIndexes();
  }
  logger.info(`Indexes synced for ${modelNames.length} models`);
  return modelNames;
}

export async function disconnectDatabase() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}
