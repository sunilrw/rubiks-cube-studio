#!/usr/bin/env bash
# Deploys Rubik's Cube Studio to rstudio.uti1.com on the Contabo server.
# Run on your Mac from the project folder, setting SERVER to your SSH target.
# Optional: set SSH_KEY to use a specific key file, and EXPECTED_IP to check DNS.
set -euo pipefail
cd "$(dirname "$0")/.."
SERVER="${SERVER:-}"
DOMAIN="rstudio.uti1.com"
WEBROOT="/var/www/rstudio"
EXPECTED_IP="${EXPECTED_IP:-}"
if [ -z "$SERVER" ]; then echo "Set SERVER to your SSH target, for example SERVER=root@your-server bash deploy/deploy-contabo.sh"; exit 1; fi
OPTS=""; [ -n "${SSH_KEY:-}" ] && OPTS="-i $SSH_KEY -o IdentitiesOnly=yes"
SSH="ssh $OPTS"; SCP="scp $OPTS"
[ -f index.html ] || { echo "index.html not found. Run this from the RubiksCube3D folder."; exit 1; }

echo "1/4 Checking DNS"
if [ -n "$EXPECTED_IP" ]; then dig +short "$DOMAIN" | grep -qx "$EXPECTED_IP" || echo "  Warning: $DOMAIN does not resolve to EXPECTED_IP ($EXPECTED_IP). HTTPS may fail until DNS is updated."; fi

echo "2/4 Uploading files"
$SSH $SERVER "mkdir -p $WEBROOT"
$SCP index.html "$SERVER:$WEBROOT/index.html"
$SCP deploy/rstudio.uti1.com.nginx.conf "$SERVER:/tmp/$DOMAIN.conf"

echo "3/4 Adding the nginx site (only this new site; removed again if the test fails)"
$SSH $SERVER "set -e
chmod 644 $WEBROOT/index.html
cp /tmp/$DOMAIN.conf /etc/nginx/sites-available/$DOMAIN
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
if nginx -t; then systemctl reload nginx; else rm -f /etc/nginx/sites-enabled/$DOMAIN; echo 'nginx test failed: site removed, nothing reloaded'; exit 1; fi"

echo "4/4 HTTPS with Let's Encrypt"
$SSH $SERVER "if command -v certbot >/dev/null; then certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email --redirect; else echo 'certbot is not installed: the site is live on http only'; fi"
echo "Done: https://$DOMAIN"
