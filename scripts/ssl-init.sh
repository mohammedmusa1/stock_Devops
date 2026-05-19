#!/usr/bin/env bash
# Let's Encrypt SSL on EC2 (host certbot, nginx in Docker)
# Usage: sudo ./scripts/ssl-init.sh yourdomain.com you@email.com
set -euo pipefail

DOMAIN="${1:?Usage: ssl-init.sh domain.com email@example.com}"
EMAIL="${2:?}"

sudo apt-get update -y
sudo apt-get install -y certbot

sudo mkdir -p infrastructure/nginx/certs
sudo certbot certonly --webroot \
  -w "$(pwd)/infrastructure/nginx/certs" \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive

echo "Certificates issued. Copy infrastructure/nginx/namestock.ssl.conf.example to active nginx config and reload nginx container."
