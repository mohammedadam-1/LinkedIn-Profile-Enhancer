#!/usr/bin/env bash
# Deploys a synced release to the production VM.
# Usage: sudo deploy.sh <release-sha>
# Runs as root; services execute as the "linkedin" user.
set -euo pipefail

SHA="${1:?usage: deploy.sh <release-sha>}"
APP="/opt/linkedin"
RELEASE="$APP/releases/$SHA"
CURRENT="$APP/current"
BACKEND="$RELEASE/Linkedin-Scraper"
UI="$RELEASE/UI"
SERVICE_USER="linkedin"

if [[ ! -d "$BACKEND" || ! -d "$UI" ]]; then
    echo "release $RELEASE is incomplete; aborting" >&2
    exit 1
fi

echo "==> Fixing ownership"
chown -R "$SERVICE_USER:$SERVICE_USER" "$RELEASE"

echo "==> Installing backend dependencies"
cd "$BACKEND"
sudo -u "$SERVICE_USER" -H npm ci --no-audit --no-fund
sudo -u "$SERVICE_USER" -H npx playwright install chromium

echo "==> Building UI"
cd "$UI"
sudo -u "$SERVICE_USER" -H npm ci --no-audit --no-fund
sudo -u "$SERVICE_USER" -H npm run build

echo "==> Updating Caddyfile with production domain"
SITE_DOMAIN="$(grep '^SITE_DOMAIN=' "$APP/.env" | cut -d= -f2- | tr -d '"' || true)"
SITE_DOMAIN="${SITE_DOMAIN:-linkedin.example.com}"
sed "s|linkedin.example.com|$SITE_DOMAIN|g" "$RELEASE/deploy/Caddyfile" > /tmp/Caddyfile.linkedin
install -o root -g root -m 644 /tmp/Caddyfile.linkedin /etc/caddy/Caddyfile
systemctl reload caddy

echo "==> Switching release symlink"
ln -sfn "$RELEASE" "$CURRENT"

echo "==> Restarting services"
systemctl daemon-reload
systemctl restart linkedin-api
systemctl restart linkedin-worker.timer

echo "==> Smoke test"
sleep 2
curl -fsS http://127.0.0.1:3001/api/health > /dev/null && echo "API healthy"
curl -fsS -o /dev/null http://127.0.0.1/ && echo "UI serving"

echo "==> Deploy of $SHA complete"
