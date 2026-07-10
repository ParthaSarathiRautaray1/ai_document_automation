/**
 * Server bootstrap / composition root.
 *
 * Connects to MongoDB, starts the HTTP server, and wires graceful shutdown +
 * safety nets for unhandled rejections and uncaught exceptions so the process
 * never lingers in a broken state.
 */
import http from 'node:http';
import app from './app.js';
import env from './config/env.js';
import logger from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';

let server;

async function start() {
  await connectDatabase();

  server = http.createServer(app);
  server.listen(env.PORT, () => {
    logger.info(`DocFlow AI API running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    logger.info(`Base URL: http://localhost:${env.PORT}${env.API_PREFIX}`);
  });
}

async function shutdown(signal) {
  logger.warn(`${signal} received. Shutting down gracefully...`);
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
    logger.info('Shutdown complete.');
    process.exit(0);
  } catch (err) {
    logger.error(`Error during shutdown: ${err.message}`);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  logger.error(err.stack);
  shutdown('uncaughtException');
});

start().catch((err) => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});

export default app;
