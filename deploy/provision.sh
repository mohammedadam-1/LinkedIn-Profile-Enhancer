#!/usr/bin/env bash
# One-time provisioning for the production VM (Ubuntu 22.04/24.04).
# Run as a user with passwordless sudo after the repo is cloned, e.g.:
#   git clone <repo> /opt/linkedin-src && cd /opt/linkedin-src && sudo bash deploy/provision.sh
set -euo pipefail

APP_DIR="/opt/linkedin"
SERVICE_USER="linkedin"
APP_USER="${SUDO_USER:-$(id -un)}"

if [[ "$APP_USER" == "root" ]]; then
    echo "run this script as a non-root sudo user" >&2
    exit 1
fi

echo "==> Installing system packages"
apt-get update
apt-get install -y curl git ca-certificates caddy

if ! command -v node > /dev/null 2>&1; then
    echo "==> Installing Node.js 22"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

echo "==> Creating service user"
if ! id -u "$SERVICE_USER" > /dev/null 2>&1; then
    useradd --system --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

echo "==> Creating app directories"
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" "$APP_DIR"
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" "$APP_DIR/releases"
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" "$APP_DIR/chrome-profile"

echo "==> Installing backend dependencies and Playwright system libraries"
cd Linkedin-Scraper
npm ci --no-audit --no-fund
npx playwright install-deps chromium
npx playwright install chromium
cd ..

echo "==> Installing systemd units"
install -o root -g root -m 644 deploy/linkedin-api.service /etc/systemd/system/
install -o root -g root -m 644 deploy/linkedin-worker.service /etc/systemd/system/
install -o root -g root -m 644 deploy/linkedin-worker.timer /etc/systemd/system/
install -o root -g root -m 644 deploy/Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now linkedin-api linkedin-worker.timer caddy

echo "==> Granting passwordless sudo to $APP_USER (dedicated single-app VM)"
cat > /etc/sudoers.d/linkedin-deploy <<EOF
$APP_USER ALL=(ALL) NOPASSWD: ALL
EOF
chmod 440 /etc/sudoers.d/linkedin-deploy

echo
echo "Provisioning complete. Remaining manual steps:"
echo "  1. Put a persistent volume at /opt/linkedin (Chrome profile is /opt/linkedin/chrome-profile)"
echo "  2. Create /opt/linkedin/.env from Linkedin-Scraper/.env.example, adding:"
echo "     CHROME_USER_DATA_DIR=/opt/linkedin/chrome-profile"
echo "     CHROME_HEADLESS=true"
echo "     SITE_DOMAIN=<your-domain>"
echo "  3. Sign in once: cd /opt/linkedin-src/Linkedin-Scraper && npm run chrome:login"
echo "     (set CHROME_USER_DATA_DIR=/opt/linkedin/chrome-profile when running it)"
echo "  4. Point DNS for your domain at this VM"
echo "  5. Push to main to deploy; configure the GitHub secrets listed in .github/workflows/deploy.yml"
