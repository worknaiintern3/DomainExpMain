#!/usr/bin/env bash
set -Eeuo pipefail
# shellcheck disable=SC1091
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
lock_deployment
bash "$DEPLOY_DIR/preflight.sh"
verify_local
python3 - <<'PY'
import socket
addresses = {item[4][0] for item in socket.getaddrinfo('app.domainexp.info', 443, socket.AF_INET)}
if addresses != {'200.234.45.233'}:
    raise SystemExit('DNS must point directly to 200.234.45.233 before first SSL/Nginx installation')
PY
docker exec "$CENTRAL_NGINX" test -s /etc/letsencrypt/live/app.domainexp.info/fullchain.pem
docker exec "$CENTRAL_NGINX" test -s /etc/letsencrypt/live/app.domainexp.info/privkey.pem
# Resolve the existing bind/volume mount; never replace a whole config directory.
config_dir="$(docker inspect "$CENTRAL_NGINX" | python3 -c '
import json,sys
mounts=json.load(sys.stdin)[0]["Mounts"]
for m in sorted(mounts,key=lambda m:len(m["Destination"]),reverse=True):
    d=m["Destination"].rstrip("/")
    if d in ("/etc/nginx/conf.d","/etc/nginx"):
        print(m["Source"]+("/conf.d" if d=="/etc/nginx" else ""));break
else: raise SystemExit("Central Nginx needs an existing persistent directory mount for conf.d; no container recreation is allowed")
')"
[[ -d "$config_dir" && -w "$config_dir" ]] || { echo 'Run installation as a user allowed to write the central config mount.' >&2; exit 1; }
target="$config_dir/app.domainexp.info.conf"
[[ ! -L "$target" ]] || { echo 'Refusing to overwrite a symlinked domain config.' >&2; exit 1; }
backup=''
if [[ -f "$target" ]]; then
  grep -q "Managed exclusively by DomainExp" "$target" || { echo 'Existing same-name config is not owned by this setup; refusing overwrite.' >&2; exit 1; }
  backup="$target.domainexp-backup-$(date +%s)"
  cp -p -- "$target" "$backup"
fi
connected=0
network_connected="$(docker inspect -f '{{json .NetworkSettings.Networks}}' "$CENTRAL_NGINX" | python3 -c 'import json,sys; print("yes" if "domainexp_app_proxy" in json.load(sys.stdin) else "no")')"
if [[ "$network_connected" == no ]]; then
  docker network connect domainexp_app_proxy "$CENTRAL_NGINX"
  connected=1
fi
restore() {
  local status=$?
  trap - ERR
  if [[ -n "$backup" ]]; then cp -p -- "$backup" "$target"; else rm -f -- "$target"; fi
  if [[ "$connected" == 1 ]]; then docker network disconnect domainexp_app_proxy "$CENTRAL_NGINX" || true; fi
  echo 'Domain config restored; broken Nginx configuration was not reloaded.' >&2
  exit "$status"
}
trap restore ERR
install -m 644 "$DEPLOY_DIR/nginx/app.domainexp.info.conf" "$target"
docker exec "$CENTRAL_NGINX" nginx -t
docker exec "$CENTRAL_NGINX" nginx -s reload
trap - ERR
verify_public
echo 'Installed only app.domainexp.info; central Nginx was tested and gracefully reloaded.'
