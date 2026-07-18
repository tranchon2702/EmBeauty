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

echo "==> [1/5] Pulling latest code from Git..."
git pull --ff-only

echo "==> [2/5] Backend: Installing production dependencies..."
cd "$ROOT_DIR/backend"
npm install --omit=dev

echo "==> [3/5] Frontend: Installing dependencies and building..."
cd "$ROOT_DIR/frontend"
npm install
# Note: Vite builds static assets. VITE_API_URL should point to the backend domain.
# We load the VITE_API_URL from local .env.production if it exists, or pass it inline.
if [ -f ".env.production" ]; then
  echo "Using configuration from .env.production..."
  npm run build
else
  echo "WARNING: .env.production not found. Building with default/fallback API URL..."
  npm run build
fi

echo "==> [4/5] Reloading PM2 process (embeauty-api)..."
pm2 reload embeauty-api --update-env || pm2 start src/app.js --name "embeauty-api" --update-env

echo "==> [5/5] Saving PM2 state..."
pm2 save

echo ""
echo "✅ Deployment completed successfully!"
pm2 status
