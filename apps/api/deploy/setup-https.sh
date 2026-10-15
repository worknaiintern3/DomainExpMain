#!/usr/bin/env bash
# ONE-TIME infrastructure setup. Normal push deployments never invoke this.
set -Eeuo pipefail
# shellcheck disable=SC1091
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
lock_deployment
python3 "$DEPLOY_DIR/preflight.py" "$BACKEND_HOST_PORT"
config_dir="$(python3 "$DEPLOY_DIR/nginx-mounts.py" /etc/nginx/conf.d)"
cert_dir="$(python3 "$DEPLOY_DIR/nginx-mounts.py" /etc/letsencrypt)"
webroot="$(python3 "$DEPLOY_DIR/nginx-mounts.py" /var/www/certbot)"
target="$config_dir/$DOMAIN.conf"
[[ -d "$config_dir" && -d "$cert_dir" && -d "$webroot" && ! -L "$target" ]]
backup=''
if [[ -f "$target" ]]; then
  grep -q 'Managed exclusively by DomainExp' "$target" || { echo 'Domain config is not owned by DomainExp.' >&2; exit 1; }
  backup="$(mktemp)"
  cp -p -- "$target" "$backup"
fi
restore() {
  local status=$?
  trap - ERR
  if [[ -n "$backup" ]]; then cp -p -- "$backup" "$target"; else rm -f -- "$target"; fi
  if docker exec "$CENTRAL_NGINX" nginx -t; then
    if ! docker exec "$CENTRAL_NGINX" nginx -s reload; then echo 'Domain configuration restoration reload failed.' >&2; fi
  else
    echo 'Restored configuration did not validate; central Nginx was not restarted.' >&2
  fi
  [[ -z "$backup" ]] || rm -f -- "$backup"
  exit "$status"
}
trap restore ERR
if [[ ! -s "$cert_dir/live/$DOMAIN/fullchain.pem" ]]; then
  cat > "$target" <<'NGINX'
# Managed exclusively by DomainExp's one-time certificate setup.
server {
    listen 80;
    listen [::]:80;
    server_name app.domainexp.info;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type text/plain;
        try_files $uri =404;
    }
    location / { return 503; }
}
NGINX
  docker exec "$CENTRAL_NGINX" nginx -t
  docker exec "$CENTRAL_NGINX" nginx -s reload
  docker run --rm --name domainexp_app_certbot \
    --mount "type=bind,src=$cert_dir,dst=/etc/letsencrypt" \
    --mount "type=bind,src=$webroot,dst=/var/www/certbot" \
    certbot/certbot:v5.0.0 certonly --webroot -w /var/www/certbot \
    --cert-name "$DOMAIN" -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email
fi
install -m 644 "$DEPLOY_DIR/nginx/$DOMAIN.conf" "$target"
docker exec "$CENTRAL_NGINX" nginx -t
docker exec "$CENTRAL_NGINX" nginx -s reload
printf '%s\n' '17 3,15 * * * root bash /opt/domainexp-app/apps/api/deploy/renew-ssl.sh >> /var/log/domainexp-app-ssl.log 2>&1' \
  > /etc/cron.d/domainexp-app-ssl
chmod 644 /etc/cron.d/domainexp-app-ssl
trap - ERR
[[ -z "$backup" ]] || rm -f -- "$backup"
echo 'DomainExp certificate and automatic renewal installed; application health remains a separate required deployment check.'
