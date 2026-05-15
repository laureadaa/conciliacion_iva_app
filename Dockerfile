# =========================================
# Multi-stage Dockerfile for Freelance Suite
# Single image serves both API and built React client
# =========================================

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++ tini sqlite

# ---- Install full deps (incl. dev) for build ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci --no-audit --no-fund

# ---- Build everything ----
FROM deps AS build
COPY . .
RUN npm run build -w shared \
  && npm run build -w server \
  && npm run build -w client

# ---- Production runtime ----
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache tini sqlite \
  && addgroup -g 1001 app && adduser -S -u 1001 -G app app \
  && mkdir -p /app/data /app/backups \
  && chown -R app:app /app
ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL=/app/data/app.db

# Copy package manifests and install prod-only deps
COPY --chown=app:app package.json package-lock.json* ./
COPY --chown=app:app shared/package.json ./shared/
COPY --chown=app:app server/package.json ./server/
RUN npm ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force

# Bring built artifacts
COPY --chown=app:app --from=build /app/shared/dist ./shared/dist
COPY --chown=app:app --from=build /app/server/dist ./server/dist
COPY --chown=app:app --from=build /app/client/dist ./client/dist

# Backup script
COPY --chown=app:app scripts/backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

USER app
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/dist/index.js"]
