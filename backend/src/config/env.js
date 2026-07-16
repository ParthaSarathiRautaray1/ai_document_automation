/**
 * Environment configuration loader & validator.
 *
 * Loads variables from `.env` and validates them with Zod at startup so the
 * application fails fast (before accepting traffic) if configuration is missing
 * or malformed. Nothing else in the codebase should read `process.env` directly;
 * import from this module instead.
 */
import dotenv from 'dotenv';
import { z } from 'zod';
import { productionConfigErrors, productionConfigWarnings } from './production.guard.js';

dotenv.config();

const booleanFromString = (defaultValue) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? defaultValue : v === 'true'));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_PREFIX: z.string().startsWith('/').default('/api/v1'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  // Additional browser origins allowed to call the API (comma-separated).
  // CLIENT_URL is always allowed; this covers extra domains (www, staging, …).
  CORS_ORIGINS: z.string().optional().default(''),
  // Hops to trust for the client IP behind a proxy/CDN (rate limiting + logs).
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  // Max accepted request body size (Express/`bytes` syntax).
  JSON_BODY_LIMIT: z.string().default('1mb'),
  // Grace period for in-flight requests during shutdown before forcing exit.
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  // Reconcile model indexes with the database on boot. Required in production,
  // where `autoIndex` is off — without it, unique/partial indexes never exist.
  DB_SYNC_INDEXES: booleanFromString(true),
  // Optional DNS resolvers for `mongodb+srv://` SRV lookups. Only set this when
  // the host's resolver cannot do SRV (a known Windows/corporate-DNS issue);
  // forcing public DNS inside a VPC breaks private-zone resolution.
  DB_SRV_DNS_SERVERS: z.string().optional().default(''),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  RESET_TOKEN_EXPIRES_MIN: z.coerce.number().int().positive().default(15),

  RATE_LIMIT_WINDOW_MIN: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  BREVO_API_KEY: z.string().optional().default(''),
  EMAIL_FROM_NAME: z.string().default('DocFlow AI'),
  EMAIL_FROM_ADDRESS: z.string().default('no-reply@docflow.ai'),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),

  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_MODEL: z.string().default('meta-llama/llama-3.1-8b-instruct:free'),

  // Path to a system Chromium/Chrome for the PDF renderer. Set in containers
  // that install the browser via the OS package manager instead of Puppeteer's
  // bundled download. Empty = let Puppeteer resolve its own binary.
  PUPPETEER_EXECUTABLE_PATH: z.string().optional().default(''),

  IS_HTTPS: booleanFromString(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

const env = Object.freeze({
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  isDevelopment: parsed.data.NODE_ENV === 'development',
  // Origins allowed by CORS: CLIENT_URL plus any extras, de-duplicated.
  corsOrigins: Object.freeze([
    ...new Set(
      [parsed.data.CLIENT_URL, ...parsed.data.CORS_ORIGINS.split(',')]
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
  ]),
  // Explicit DNS resolvers for SRV lookups (empty = use the system resolver).
  dbSrvDnsServers: Object.freeze(
    parsed.data.DB_SRV_DNS_SERVERS.split(',')
      .map((server) => server.trim())
      .filter(Boolean)
  ),
});

// Production-only safety checks the schema cannot express (placeholder secrets,
// localhost URLs). Fail fast rather than serving traffic with an unsafe config.
if (env.isProduction) {
  const errors = productionConfigErrors(env);
  if (errors.length) {
    const list = errors.map((problem) => `  - ${problem}`).join('\n');
    console.error(`\n❌ Unsafe production configuration:\n${list}\n`);
    process.exit(1);
  }
  for (const warning of productionConfigWarnings(env)) {
    console.warn(`⚠️  ${warning}`);
  }
}

export default env;
