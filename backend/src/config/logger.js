/**
 * Centralized application logger (Winston).
 *
 * - Human-readable, colorized output in development.
 * - Structured JSON in production (friendly to log aggregators).
 * - Silent during tests to keep test output clean.
 */
import winston from 'winston';
import env from './env.js';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack }) => {
    return `${ts} ${level}: ${stack || message}`;
  })
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const logger = winston.createLogger({
  level: env.isProduction ? 'info' : 'debug',
  format: env.isProduction ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
  silent: env.isTest,
});

export default logger;
