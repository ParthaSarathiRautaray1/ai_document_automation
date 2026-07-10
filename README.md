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

## Backend — quick start
```bash
cd backend
cp .env.example .env      # then edit secrets
npm install
npm run dev               # start API (http://localhost:5000/api/v1)
npm test                  # run test suite (in-memory MongoDB)
```
Requires Node ≥ 20. A local MongoDB is only needed for `npm run dev`; tests use
an in-memory server.

## Status
Module 1 (Authentication) in progress — **Task 1 (Backend Foundation & User
Model) complete and verified (9/9 tests passing).** See the roadmap for what's
next.
