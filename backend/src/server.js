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
import { connectDatabase, disconnectDatabase, syncIndexes } from './config/database.js';
import { closeBrowser } from './features/documents/pdf.renderer.js';

let server;
let shuttingDown = false;

async function start() {
  await connectDatabase();

  // Models are registered by importing `app` above. With `autoIndex` off in
  // production this is the only thing that creates the unique/partial indexes
  // the data model depends on, so it runs BEFORE the server accepts traffic.
  if (env.DB_SYNC_INDEXES) {
    await syncIndexes();
  }

  server = http.createServer(app);
  server.listen(env.PORT, () => {
    logger.info(`DocFlow AI API running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    logger.info(`Base URL: http://localhost:${env.PORT}${env.API_PREFIX}`);
  });
}

async function shutdown(signal) {
  // A second signal (or a failure cascade) must not re-enter the teardown.
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn(`${signal} received. Shutting down gracefully...`);

  // A hung in-flight request must not keep the process alive forever — the
  // orchestrator would eventually SIGKILL it, skipping cleanup entirely.
  const forceExit = setTimeout(() => {
    logger.error(`Shutdown exceeded ${env.SHUTDOWN_TIMEOUT_MS}ms — forcing exit.`);
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await closeBrowser();
    await disconnectDatabase();
    clearTimeout(forceExit);
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
