#!/usr/bin/env bash
# Deploy jatin-tms-old-v on this VPS.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${DEPLOY_BRANCH:-jatin-tms-old-v}"

cd "$ROOT_DIR"

echo "==> Fetching ${BRANCH}"
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo "Missing $ROOT_DIR/.env — copy from .env.example and fill production values."
  exit 1
fi

# Backend reads TMS_BE/.env (see TMS_BE/src/config/config.js)
cp "$ROOT_DIR/.env" "$ROOT_DIR/TMS_BE/.env"

# Ensure FE build gets public API URL (gitignored)
if [[ -f "$ROOT_DIR/TMS_FE/.env.production" ]]; then
  :
elif grep -q '^NEXT_PUBLIC_API_URL=' "$ROOT_DIR/.env"; then
  grep -E '^(NEXT_PUBLIC_API_URL)=' "$ROOT_DIR/.env" > "$ROOT_DIR/TMS_FE/.env.production"
else
  echo 'NEXT_PUBLIC_API_URL=https://task.rentfoxxy.com/api' > "$ROOT_DIR/TMS_FE/.env.production"
fi

echo "==> Ensuring database"
bash "$ROOT_DIR/scripts/setup-db.sh" "$ROOT_DIR/.env"

echo "==> Installing backend deps"
cd "$ROOT_DIR/TMS_BE"
npm ci --omit=dev || npm install --omit=dev

echo "==> Installing + building frontend"
cd "$ROOT_DIR/TMS_FE"
npm ci || npm install
npm run build

echo "==> Restarting PM2 apps"
cd "$ROOT_DIR"
# Replace legacy single "taskflow" process if present
pm2 delete taskflow >/dev/null 2>&1 || true
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "==> Health checks"
sleep 2
curl -fsS "http://127.0.0.1:4011/health" || curl -fsS "http://127.0.0.1:${PORT:-4011}/health" || true
curl -fsSI "http://127.0.0.1:3010" >/dev/null && echo "Frontend OK on :3010"
curl -fsS "http://127.0.0.1:4011/api/socket.io/?EIO=4&transport=polling" | head -c 80 && echo "" && echo "Socket.IO OK on /api/socket.io"

echo "==> Nginx (optional — copy site config if you maintain it on the server)"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/task.rentfoxxy.com}"
if [[ -f "$ROOT_DIR/deploy/nginx-task.rentfoxxy.com.conf" ]] && [[ -w "$(dirname "$NGINX_SITE")" || -w "$NGINX_SITE" ]]; then
  cp "$ROOT_DIR/deploy/nginx-task.rentfoxxy.com.conf" "$NGINX_SITE"
  nginx -t && systemctl reload nginx && echo "Nginx reloaded"
else
  echo "Skip nginx copy (no permission or file missing). Socket.IO uses /api/socket.io via existing /api/ proxy."
fi

echo "✅ Deploy complete"
