#!/usr/bin/env bash
set -Eeuo pipefail

central='gymproplus-nginx-1'
helper='/opt/domainexp-app/apps/api/deploy/nginx-mounts.py'
cert_dir="$(python3 "$helper" /etc/letsencrypt)"
webroot="$(python3 "$helper" /var/www/certbot)"

docker run --rm --name domainexp_website_certbot \
  --mount "type=bind,src=$cert_dir,dst=/etc/letsencrypt" \
  --mount "type=bind,src=$webroot,dst=/var/www/certbot" \
  certbot/certbot:v5.0.0 renew --cert-name domainexp.info \
  --webroot -w /var/www/certbot --non-interactive --quiet
docker exec "$central" nginx -t
docker exec "$central" nginx -s reload
