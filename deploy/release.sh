#!/usr/bin/env bash
# Runs on the deploy machine after GitHub Actions has synced a release.
set -euo pipefail

APP_DIR="${DEPLOY_PATH:-/opt/yogisdepot}"
API_SERVICE="${API_SERVICE:-yogisdepot-api}"

run_privileged() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo -n "$@"
  fi
}

if [ ! -f "$APP_DIR/backend/.env" ]; then
  echo "Missing $APP_DIR/backend/.env. Create it before the first deploy." >&2
  exit 1
fi

if [ ! -f "$APP_DIR/backend/package.json" ] || [ ! -d "$APP_DIR/backend/dist" ]; then
  echo "Backend release files are missing under $APP_DIR/backend." >&2
  exit 1
fi

if [ ! -f "$APP_DIR/frontend/dist/index.html" ]; then
  echo "Frontend build is missing at $APP_DIR/frontend/dist/index.html." >&2
  exit 1
fi

if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Node.js 20+ and npm must be installed on this machine." >&2
  exit 1
fi

mkdir -p "$APP_DIR/backend/uploads"
cd "$APP_DIR/backend"
npm ci --omit=dev

if ! run_privileged systemctl cat "$API_SERVICE" >/dev/null 2>&1; then
  echo "systemd unit $API_SERVICE is not installed. See deploy/README.md." >&2
  exit 1
fi

run_privileged systemctl restart "$API_SERVICE"

PORT="$(grep -E '^PORT=' .env | tail -1 | cut -d= -f2- | tr -d ' "'\''\r' || true)"
PORT="${PORT:-5000}"

healthy=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null; then
    healthy=1
    break
  fi
  sleep 1
done

if [ "$healthy" -ne 1 ]; then
  echo "API did not respond on port ${PORT}. Check: journalctl -u ${API_SERVICE} -n 80" >&2
  exit 1
fi

if ! command -v nginx >/dev/null; then
  echo "nginx is not installed. The API is up, but the storefront is not being served." >&2
  exit 1
fi

run_privileged nginx -t
run_privileged systemctl reload nginx

echo "Deployed Yogi's Depot from $APP_DIR"
