#!/usr/bin/env bash
# Run ON the server (as root or with sudo) after copying index.html and the nginx conf to /tmp.
# It only adds one new site. It does not touch any existing nginx site.
set -euo pipefail
DOMAIN=rstudio.uti1.com
install -d -m 755 /var/www/rstudio
install -m 644 /tmp/index.html /var/www/rstudio/index.html
install -m 644 /tmp/rstudio.uti1.com.nginx.conf /etc/nginx/sites-available/$DOMAIN
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
nginx -t
systemctl reload nginx
echo "HTTP site is live. Now add HTTPS with:  certbot --nginx -d $DOMAIN"
