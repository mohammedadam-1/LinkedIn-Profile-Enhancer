#!/usr/bin/env bash
# Deploys a synced release to the production VM.
# Usage: sudo deploy.sh <release-sha>
set -euo pipefail

SHA="${1:?usage: deploy.sh <release-sha>}"
APP="/opt/linkedin"
RELEASE="$APP/releases/$SHA"
CURRENT="$APP/current"
BACKEND="$RELEASE/Linkedin-Scraper"
UI="$RELEASE/UI"
SERVICE_USER="linkedin"

# 1. Enforce root execution
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (sudo)" >&2
   exit 1
fi

# 2. Validate release directories
if [[ ! -d "$BACKEND" || ! -d "$UI" ]]; then
    echo "Error: Release $RELEASE is incomplete or missing." >&2
    exit 1
fi

# 3. Handle Playwright isolated caching
export PLAYWRIGHT_BROWSERS_PATH="$RELEASE/.playwright-browsers"

echo "==> Fixing ownership"
chown -R "$SERVICE_USER:$SERVICE_USER" "$RELEASE"

echo "==> Installing backend dependencies"
cd "$BACKEND"
sudo -u "$SERVICE_USER" -H -E npm ci --no-audit --no-fund
sudo -u "$SERVICE_USER" -H -E npx playwright install chromium

echo "==> Building UI"
cd "$UI"
sudo -u "$SERVICE_USER" -H npm ci --no-audit --no-fund
sudo -u "$SERVICE_USER" -H npm run build

echo "==> Updating Caddyfile with production domain"
# Fix: Safe extraction without breaking set -o pipefail
SITE_DOMAIN=$(awk -F= '/^SITE_DOMAIN=/ {gsub(/"/, "", $2); print $2}' "$APP/.env" || true)
SITE_DOMAIN="${SITE_DOMAIN:-linkedin.example.com}"

# Fix: Secure temporary file creation
TMP_CADDY=$(mktemp /tmp/caddy.XXXXXX)
sed "s|linkedin.example.com|$SITE_DOMAIN|g" "$RELEASE/deploy/Caddyfile" > "$TMP_CADDY"
install -o root -g root -m 644 "$TMP_CADDY" /etc/caddy/Caddyfile
rm -f "$TMP_CADDY"
systemctl reload caddy

echo "==> Switching release symlink atomically"
# Fix: Atomic symlink switch prevents zero-second downtime
ln -sfn "$RELEASE" "$CURRENT.tmp"
mv -Tf "$CURRENT.tmp" "$CURRENT"

echo "==> Restarting services"
systemctl daemon-reload
systemctl restart linkedin-api
systemctl restart linkedin-worker.timer

echo "==> Smoke test"
sleep 2
if ! curl -fsS http://127.0.0.1:3001/api/health > /dev/null; then
    echo "CRITICAL: API smoke test failed!" >&2
    exit 1
fi

if ! curl -fsS -o /dev/null http://127.0.0.1/; then
    echo "CRITICAL: UI smoke test failed!" >&2
    exit 1
fi

echo "==> Deploy of $SHA complete"
