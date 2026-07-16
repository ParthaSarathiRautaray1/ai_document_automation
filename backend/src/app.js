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
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import env from './config/env.js';
import logger from './config/logger.js';
import apiRouter from './routes/index.js';
import notFound from './middlewares/notFound.js';
import errorHandler from './middlewares/errorHandler.js';
import requestId from './middlewares/requestId.js';
import { globalLimiter } from './middlewares/rateLimiter.js';

const app = express();

app.disable('x-powered-by');
// Trust exactly as many proxy hops as are actually in front of us. Trusting
// blindly would let a client spoof X-Forwarded-For and evade the rate limiter.
app.set('trust proxy', env.TRUST_PROXY);

// --- Correlation id (first, so everything below can log it) ---
app.use(requestId);

// --- Security ---
app.use(
  helmet({
    // The API serves JSON, never HTML — lock the CSP down to nothing rather than
    // shipping helmet's default policy for a document it will never return.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    // Only advertise HSTS once TLS actually terminates in front of the API —
    // sending it over plain HTTP can lock clients out of a non-TLS deployment.
    hsts: env.IS_HTTPS ? { maxAge: 15_552_000, includeSubDomains: true } : false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
  })
);
app.use(
  cors({
    // An allowlist (CLIENT_URL + CORS_ORIGINS) rather than a single origin, so a
    // deployment can serve www/apex/staging without reflecting arbitrary origins.
    origin(origin, callback) {
      // Same-origin/non-browser callers (curl, health probes) send no Origin.
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Content-Disposition', 'X-Request-Id'],
  })
);

// --- Body & cookie parsing ---
app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: env.JSON_BODY_LIMIT }));
app.use(cookieParser());
app.use(hpp()); // guard against HTTP parameter pollution

// --- Compression (JSON lists and PDF-adjacent payloads benefit most) ---
app.use(compression());

// --- Request logging (skipped during tests) ---
if (!env.isTest) {
  morgan.token('id', (req) => req.id);
  app.use(
    morgan(
      env.isProduction ? ':id :remote-addr :method :url :status :res[content-length] :response-time ms' : 'dev',
      { stream: { write: (msg) => logger.http?.(msg.trim()) ?? logger.info(msg.trim()) } }
    )
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
