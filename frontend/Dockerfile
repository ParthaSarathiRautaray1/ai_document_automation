# syntax=docker/dockerfile:1
# ============================================================
# DocFlow AI — frontend (React + Vite, served by nginx)
# ============================================================
# Vite inlines VITE_* variables at BUILD time, not run time — so the API URL is a
# build argument, not a container env var. Rebuild the image to point a deploy at
# a different API.

# --- build -------------------------------------------------------------------
FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=http://localhost:5000/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- serve -------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
