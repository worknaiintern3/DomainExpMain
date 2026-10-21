#!/usr/bin/env bash
set -Eeuo pipefail

# Frontend-only first installation on the existing DomainExp VPS.
# Input is the release archive created from this repository's static builds.
archive="${1:-}"
[[ -f "$archive" ]] || { echo 'Usage: bash install.sh /path/to/website-release.tar.gz' >&2; exit 1; }

central='gymproplus-nginx-1'
backend='domainexp_app_backend'
frontend='domainexp_website'
helper='/opt/domainexp-app/apps/api/deploy/nginx-mounts.py'
[[ -f "$helper" ]] || { echo 'Existing backend checkout is missing its read-only Nginx mount helper.' >&2; exit 1; }
[[ "$(docker inspect -f '{{.State.Running}}' "$central")" == true ]]
[[ "$(docker inspect -f '{{.State.Running}}' "$backend")" == true ]]
[[ -z "$(docker ps -aq --filter "name=^/${frontend}$")" ]] || {
  echo 'A website container already exists; refusing to replace it automatically.' >&2; exit 1;
}

config_dir="$(python3 "$helper" /etc/nginx/conf.d)"
cert_dir="$(python3 "$helper" /etc/letsencrypt)"
webroot="$(python3 "$helper" /var/www/certbot)"
target="$config_dir/domainexp.info.conf"
[[ -d "$config_dir" && -d "$cert_dir" && -d "$webroot" && ! -e "$target" && ! -L "$target" ]] || {
  echo 'The domain vhost already exists or a required Nginx mount is unavailable.' >&2; exit 1;
}

network="$(docker inspect "$central" "$backend" | python3 -c '
import json, sys
nginx, backend = json.load(sys.stdin)
shared = set(nginx["NetworkSettings"]["Networks"]) & set(backend["NetworkSettings"]["Networks"])
if len(shared) != 1:
    raise SystemExit("Expected exactly one existing shared proxy network")
print(next(iter(shared)))
')"

release_root='/opt/domainexp-website/releases'
mkdir -p "$release_root"
release="$(mktemp -d "$release_root/website-XXXXXXXX")"
tar -xzf "$archive" -C "$release"
[[ -s "$release/apps/landing/out/index.html" && -s "$release/apps/web/dist/index.html" ]]
[[ -s "$release/deploy/website/static.conf" && -s "$release/deploy/website/domainexp.info.conf" ]]

installed=0
started=0
rollback() {
  local status=$?
  trap - ERR
  if [[ "$installed" == 1 ]]; then
    rm -f -- "$target"
    docker exec "$central" nginx -t && docker exec "$central" nginx -s reload || true
  fi
  if [[ "$started" == 1 ]]; then docker rm -f "$frontend" >/dev/null || true; fi
  echo 'Website installation failed; original backend and its vhost were left untouched.' >&2
  exit "$status"
}
trap rollback ERR

docker run -d --name "$frontend" --network "$network" --restart unless-stopped \
  --mount "type=bind,src=$release/apps/landing/out,dst=/usr/share/nginx/landing,readonly" \
  --mount "type=bind,src=$release/apps/web/dist,dst=/usr/share/nginx/web,readonly" \
  --mount "type=bind,src=$release/deploy/website/static.conf,dst=/etc/nginx/conf.d/default.conf,readonly" \
  nginx:1.27-alpine >/dev/null
started=1
docker exec "$frontend" nginx -t

if [[ ! -s "$cert_dir/live/domainexp.info/fullchain.pem" ]]; then
  install -m 644 "$release/deploy/website/domainexp.info.http.conf" "$target"
  installed=1
  docker exec "$central" nginx -t
  docker exec "$central" nginx -s reload
  docker run --rm --name domainexp_website_certbot \
    --mount "type=bind,src=$cert_dir,dst=/etc/letsencrypt" \
    --mount "type=bind,src=$webroot,dst=/var/www/certbot" \
    certbot/certbot:v5.0.0 certonly --webroot -w /var/www/certbot \
    --cert-name domainexp.info -d domainexp.info \
    --non-interactive --agree-tos --email admin@domainexp.info
fi

install -m 644 "$release/deploy/website/domainexp.info.conf" "$target"
installed=1
docker exec "$central" nginx -t
docker exec "$central" nginx -s reload

landing_check="$(mktemp)"
app_check="$(mktemp)"
api_headers="$(mktemp)"
trap 'rm -f -- "$landing_check" "$app_check" "$api_headers"' EXIT
curl -fsS --max-time 20 https://domainexp.info/ -o "$landing_check"
grep -q 'DomainPulse' "$landing_check"
curl -fsS --max-time 20 https://domainexp.info/login -o "$app_check"
grep -q 'id="root"' "$app_check"
api_status="$(curl -sS --max-time 20 -D "$api_headers" -o /dev/null -w '%{http_code}' \
  https://domainexp.info/api/v1/auth/login-methods)"
[[ "$api_status" == 200 || "$api_status" == 401 ]]
grep -Eqi '^content-type: application/(json|problem\+json)' "$api_headers"
curl -fsS --max-time 20 https://app.domainexp.info/health >/dev/null
trap - ERR
echo 'Website is live at https://domainexp.info; existing backend remains at https://app.domainexp.info.'
