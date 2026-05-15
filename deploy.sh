#!/usr/bin/env bash
# =====================================================
# Deploy Freelance Suite on a fresh VPS in one command.
# Requires: Docker + Docker Compose v2.
# Usage:    DOMAIN=app.midominio.com LETSENCRYPT_EMAIL=tu@email.com ./deploy.sh
# =====================================================
set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

say() { printf "${BLUE}>>> %s${NC}\n" "$1"; }
ok()  { printf "${GREEN}✓ %s${NC}\n" "$1"; }
warn(){ printf "${YELLOW}! %s${NC}\n" "$1"; }
err() { printf "${RED}✗ %s${NC}\n" "$1" >&2; }

# --- Pre-flight checks ---
command -v docker >/dev/null 2>&1 || { err "Docker is not installed. Install it first."; exit 1; }
docker compose version >/dev/null 2>&1 || { err "Docker Compose v2 is required."; exit 1; }

# --- .env bootstrap ---
if [ ! -f .env ]; then
  say "Creating .env from .env.example"
  cp .env.example .env
fi

# Set DOMAIN / LETSENCRYPT_EMAIL from environment if provided
if [ -n "${DOMAIN:-}" ]; then
  sed -i.bak "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" .env && rm -f .env.bak
  ok "DOMAIN=${DOMAIN}"
fi
if [ -n "${LETSENCRYPT_EMAIL:-}" ]; then
  sed -i.bak "s|^LETSENCRYPT_EMAIL=.*|LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL}|" .env && rm -f .env.bak
  ok "LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL}"
fi

# Generate strong JWT secret if still default
if grep -q "change-me-to-a-long-random-string" .env; then
  say "Generating strong JWT_SECRET"
  if command -v openssl >/dev/null 2>&1; then
    NEW_SECRET=$(openssl rand -hex 32)
  else
    NEW_SECRET=$(head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n' | head -c 64)
  fi
  sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${NEW_SECRET}|" .env && rm -f .env.bak
  ok "JWT_SECRET generated"
fi

# Set NODE_ENV=production
sed -i.bak "s|^NODE_ENV=.*|NODE_ENV=production|" .env && rm -f .env.bak

# --- Build + run ---
say "Building Docker image (this can take a few minutes the first time)"
docker compose build

say "Starting services"
docker compose up -d

say "Waiting for app to be healthy..."
ATTEMPTS=0
until docker compose exec -T app wget -qO- http://127.0.0.1:4000/api/health >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS+1))
  if [ $ATTEMPTS -ge 30 ]; then
    err "App did not become healthy in time. Run: docker compose logs app"
    exit 1
  fi
  sleep 2
done
ok "App is healthy"

# --- Trigger an initial backup ---
say "Creating initial backup"
docker compose exec -T backup sh /usr/local/bin/backup.sh || warn "Backup sidecar not ready yet; will run on schedule."

DOMAIN_FROM_ENV=$(grep -E '^DOMAIN=' .env | head -1 | cut -d= -f2)
echo ""
ok "Deploy complete"
echo ""
printf "${GREEN}→ App available at:${NC} https://${DOMAIN_FROM_ENV} (or http://localhost if DOMAIN=localhost)\n"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f app            # tail app logs"
echo "  docker compose exec backup sh /usr/local/bin/backup.sh   # run backup now"
echo "  docker compose ps                     # status"
echo "  docker compose down                   # stop"
