# DocFlow AI — Frontend

React 19 + Vite SPA for DocFlow AI.

**Status:** Authentication UI implemented (Module 1 · Task 7). Register, login,
forgot/reset password, protected routing, and silent session refresh are wired
to the backend API.

## Stack
- React 19 + Vite 6
- Tailwind CSS 3 with shadcn-style design tokens (light/dark)
- React Router · TanStack Query (server state) · Zustand (auth/UI state)
- React Hook Form + Zod (validation mirrors the backend)
- Axios — single instance with auth header + single-flight refresh-retry

## Getting started
```bash
npm install
cp .env.example .env      # set VITE_API_URL to your backend (default :5000/api/v1)
npm run dev               # http://localhost:5173
```
The backend must be running (see `../backend`) for auth calls to succeed. CORS
on the backend allows `CLIENT_URL` (default `http://localhost:5173`) with
credentials, so the httpOnly refresh cookie flows correctly.

## Scripts
| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build (`dist/`) |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest (unit) |

## Structure
```
src/
├── lib/            api.js · validators.js · theme.js · utils.js
├── store/          authStore.js (Zustand)
├── components/     ui/ primitives · AuthLayout · ThemeToggle · ProtectedRoute
├── features/auth/  auth.api.js · Login/Register/Forgot/Reset pages
├── pages/          DashboardPage (protected) · NotFoundPage
├── App.jsx         routes + guards
└── main.jsx        providers + theme init
```

## Auth model
The access token is held in memory only; the refresh token is an httpOnly cookie
managed by the browser. On load and on any 401, the app silently refreshes and
retries. See [../docs/Architecture.md](../docs/Architecture.md) and ADR-0013.

Design: enterprise, minimal, fast, light/dark — inspired by Stripe, Linear,
Notion, GitHub, and Vercel dashboards. Usability over animation.
