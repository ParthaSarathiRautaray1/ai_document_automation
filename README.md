# DocFlow AI

**Business Document Management & Workflow Platform** — a SaaS for managing
customers, products, and templates to generate professional business documents
(PDF/email) with approvals, version history, and audit logs. AI is an
**assistant only** (rewrite, grammar, translate, summarize, tone) — never the
author, never automatic.

## Repository layout
```
DocFlow AI/
├── backend/     # Express + MongoDB REST API (feature-based)
├── frontend/    # React 19 + Vite SPA (built from Module 1, Task 7)
├── docs/        # Living documentation (source of truth)
└── .ai/         # AI assistant working context / conventions
```

## Documentation
Start here — these are kept up to date with every task:
- [docs/Product.md](docs/Product.md) — what & why
- [docs/Architecture.md](docs/Architecture.md) — how it's built
- [docs/Database.md](docs/Database.md) — data model
- [docs/API.md](docs/API.md) — endpoint contracts
- [docs/Roadmap.md](docs/Roadmap.md) — phases & status
- [docs/Tasks.md](docs/Tasks.md) — detailed task log
- [docs/Changelog.md](docs/Changelog.md) — change history
- [docs/Decisions.md](docs/Decisions.md) — architecture decisions
- [docs/Module-1-Authentication.md](docs/Module-1-Authentication.md) — module close-out summary

## Prerequisites
- **Node ≥ 20** (developed on Node 24).
- **MongoDB** running locally (or a connection string) — only needed to run the
  backend; the test suite uses an in-memory server.

## Backend — quick start
```bash
cd backend
cp .env.example .env      # set MONGODB_URI + JWT secrets (see comments)
npm install
npm run dev               # API at http://localhost:5000/api/v1
npm test                  # 63 tests, in-memory MongoDB
npm run lint
```

## Frontend — quick start
```bash
cd frontend
cp .env.example .env      # VITE_API_URL (defaults to the backend above)
npm install
npm run dev               # SPA at http://localhost:5173
npm test                  # Vitest unit tests
npm run build             # production build
```
Run the backend first; the SPA relies on it for auth (and on CORS allowing the
`CLIENT_URL` with credentials for the httpOnly refresh cookie).

## Status
**Module 1 — Authentication & User Management: ✅ complete and verified.**
Backend 63/63 tests (7 suites), frontend 16/16 tests, both lint clean, frontend
build passing. See [docs/Module-1-Authentication.md](docs/Module-1-Authentication.md)
for the close-out summary and [docs/Roadmap.md](docs/Roadmap.md) for what's next
(Module 2 — Roles & Permissions).
