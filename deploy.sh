#!/usr/bin/env bash
# EM Beauty Nails & Makeup — Deployment Script
# Styled matching the server's existing deployment workflows.
#
# Usage (run under user deploy on VPS):
#   ssh deploy@103.72.56.217
#   cd /home/deploy/apps/embeauty
#   ./deploy.sh
#
# Make executable once: chmod +x deploy.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "==> [1/6] Pulling latest code from Git..."
git pull --ff-only

echo "==> [2/6] Checking backend configuration..."
ENV_FILE="$ROOT_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: backend/.env not found. Copy backend/.env.example and fill it in."
  exit 1
fi
# The API refuses to boot in production without real signing secrets; catch it
# here rather than after PM2 has already torn down the running process.
for VAR in JWT_SECRET JWT_REFRESH_SECRET; do
  if ! grep -qE "^${VAR}=.+" "$ENV_FILE"; then
    echo "ERROR: $VAR is missing or empty in backend/.env"
    echo "       Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    exit 1
  fi
done
if grep -qE "^(JWT_SECRET|JWT_REFRESH_SECRET)=change_me" "$ENV_FILE"; then
  echo "ERROR: JWT secrets in backend/.env are still the placeholder values."
  exit 1
fi
if ! grep -qE "^CORS_ORIGINS=.+" "$ENV_FILE"; then
  echo "WARNING: CORS_ORIGINS not set — the API will accept requests from any origin."
fi
echo "Configuration OK."

echo "==> [3/6] Backend: Installing production dependencies..."
cd "$ROOT_DIR/backend"
npm install --omit=dev

echo "==> [4/6] Frontend: Installing dependencies and building..."
cd "$ROOT_DIR/frontend"
npm install
npm run typecheck
# Note: Vite builds static assets. VITE_API_URL should point to the backend domain.
# We load the VITE_API_URL from local .env.production if it exists, or pass it inline.
if [ -f ".env.production" ]; then
  echo "Using configuration from .env.production..."
  npm run build
else
  echo "WARNING: .env.production not found. Building with default/fallback API URL..."
  npm run build
fi

echo "==> [5/6] Reloading PM2 process (embeauty-api)..."
cd "$ROOT_DIR/backend"
pm2 reload embeauty-api --update-env || pm2 start src/app.js --name "embeauty-api" --update-env

echo "==> [6/6] Saving PM2 state..."
pm2 save

echo ""
echo "✅ Deployment completed successfully!"
pm2 status
