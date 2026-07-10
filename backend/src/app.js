/**
 * Express application factory.
 *
 * Assembles the middleware pipeline (security headers, CORS, body parsing,
 * logging, rate limiting), mounts the versioned API router, and attaches the
 * 404 + global error handlers LAST so they catch everything above them.
 *
 * The app is exported without calling `listen()` so it can be imported directly
 * by the test suite (Supertest) without opening a port.
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import env from './config/env.js';
import logger from './config/logger.js';
import apiRouter from './routes/index.js';
import notFound from './middlewares/notFound.js';
import errorHandler from './middlewares/errorHandler.js';
import { globalLimiter } from './middlewares/rateLimiter.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // correct client IPs behind a proxy (rate limiting)

// --- Security ---
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// --- Body & cookie parsing ---
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(hpp()); // guard against HTTP parameter pollution

// --- Request logging (skipped during tests) ---
if (!env.isTest) {
  app.use(
    morgan(env.isProduction ? 'combined' : 'dev', {
      stream: { write: (msg) => logger.http?.(msg.trim()) ?? logger.info(msg.trim()) },
    })
  );
}

// --- Rate limiting (global) ---
app.use(env.API_PREFIX, globalLimiter);

// --- API routes ---
app.use(env.API_PREFIX, apiRouter);

// --- 404 + error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

export default app;
