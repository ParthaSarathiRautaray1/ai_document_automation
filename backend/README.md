# DocFlow AI — Backend

Express + MongoDB REST API for DocFlow AI. ESM, Node ≥ 20, feature-based
architecture.

## Stack
- Express 4 · Mongoose 8 (MongoDB)
- JWT access + rotating refresh tokens · bcryptjs
- Zod (env + request validation) · Winston logging
- helmet · CORS · hpp · express-rate-limit
- Brevo (transactional email) via native `fetch`
- Jest + Supertest + mongodb-memory-server

## Getting started
```bash
cp .env.example .env      # set MONGODB_URI + JWT_ACCESS_SECRET/JWT_REFRESH_SECRET
npm install
npm run dev               # http://localhost:5000/api/v1
```
A local MongoDB is required for `npm run dev`; the test suite spins up an
in-memory server, so no database is needed to run tests.

## Scripts
| Script | Purpose |
|--------|---------|
| `npm run dev` | Start with nodemon |
| `npm start` | Start (production) |
| `npm test` | Jest suite (in-memory MongoDB) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Structure
```
src/
├── config/        env (Zod), constants, database, logger
├── middlewares/   validate, authenticate, authorize, errorHandler, notFound, rateLimiter
├── utils/         ApiError, ApiResponse, asyncHandler, token
├── services/      email.service + templates (cross-cutting integrations)
├── features/      users/ (model), auth/ (service, controller, routes, validation)
├── routes/        root API router + health routes
├── app.js         express app factory
└── server.js      composition root (DB connect, listen, graceful shutdown)
```

## API & health
- Base URL: `http://localhost:5000/api/v1` (configurable via `API_PREFIX`).
- Health: `GET /health` (liveness), `GET /ready` (DB readiness).
- Full contracts: [../docs/API.md](../docs/API.md). Module summary:
  [../docs/Module-1-Authentication.md](../docs/Module-1-Authentication.md).

## Environment
All variables are validated by `config/env.js` at boot (fail-fast). See
[.env.example](./.env.example). Nothing reads `process.env` directly elsewhere.
