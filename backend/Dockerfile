# syntax=docker/dockerfile:1
# ============================================================
# DocFlow AI — backend (Express + MongoDB + Puppeteer)
# ============================================================
# The PDF engine (Module 8) needs a real Chromium. We install the DISTRO's
# chromium rather than letting Puppeteer download its own: the image stays
# smaller, the browser gets security updates from the package manager, and the
# bundled-download step is skipped entirely (PUPPETEER_SKIP_DOWNLOAD).

# --- deps: install production node_modules ------------------------------------
FROM node:20-bookworm-slim AS deps

ENV PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# --- runtime ------------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Chromium + the fonts it needs to render text (without fonts, generated PDFs
# come out with blank/□ glyphs). `dumb-init` gives us a real PID 1 that forwards
# SIGTERM, so the app's graceful shutdown actually runs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-dejavu-core \
      ca-certificates \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

# Run unprivileged. The `node` user ships with the base image.
USER node

EXPOSE 5000

# Liveness comes from the app's own probe; the orchestrator can also use /ready.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+(process.env.API_PREFIX||'/api/v1')+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
