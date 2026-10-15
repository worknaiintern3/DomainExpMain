#!/usr/bin/env bash
set -Eeuo pipefail
# shellcheck disable=SC1091
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
lock_deployment
cert_dir="$(python3 "$DEPLOY_DIR/nginx-mounts.py" /etc/letsencrypt)"
webroot="$(python3 "$DEPLOY_DIR/nginx-mounts.py" /var/www/certbot)"
before="$(sha256sum "$cert_dir/live/$DOMAIN/fullchain.pem")"
docker run --rm --name domainexp_app_certbot \
  --mount "type=bind,src=$cert_dir,dst=/etc/letsencrypt" \
  --mount "type=bind,src=$webroot,dst=/var/www/certbot" \
  certbot/certbot:v5.0.0 renew --cert-name "$DOMAIN" --webroot -w /var/www/certbot --non-interactive --quiet
after="$(sha256sum "$cert_dir/live/$DOMAIN/fullchain.pem")"
if [[ "$before" != "$after" ]]; then
  docker exec "$CENTRAL_NGINX" nginx -t
  docker exec "$CENTRAL_NGINX" nginx -s reload
fi
