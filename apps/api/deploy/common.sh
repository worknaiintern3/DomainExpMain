#!/usr/bin/env bash
set -Eeuo pipefail
DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(git -C "$DEPLOY_DIR" rev-parse --show-toplevel)"
export DEPLOY_DIR REPO_DIR
export DOMAIN=app.domainexp.info
export CENTRAL_NGINX=gymproplus-nginx-1
export CONTAINER=domainexp_app_backend
cd "$REPO_DIR"
for command_name in docker git flock curl python3 ss; do command -v "$command_name" >/dev/null; done
docker compose version >/dev/null
[[ -f "$DEPLOY_DIR/.env" ]] || { echo 'Missing apps/api/deploy/.env' >&2; exit 1; }
umask 077
chmod 600 "$DEPLOY_DIR/.env"
sed -E '/^[[:space:]]*(export[[:space:]]+)?MIGRATION_DATABASE_URL[[:space:]]*=/d' \
  "$DEPLOY_DIR/.env" > "$DEPLOY_DIR/.env.runtime.$$"
mv -- "$DEPLOY_DIR/.env.runtime.$$" "$DEPLOY_DIR/.env.runtime"
compose() { docker compose --project-name domainexp_app --env-file "$DEPLOY_DIR/.env" -f "$REPO_DIR/apps/api/docker-compose.prod.yml" "$@"; }
env_value() {
  python3 - "$DEPLOY_DIR/.env" "$1" <<'PY'
import sys
from pathlib import Path
for line in Path(sys.argv[1]).read_text().splitlines():
    key, sep, value = line.partition('=')
    if sep and key.strip() == sys.argv[2]:
        print(value.strip().strip('\"\'')); break
PY
}
lock_deployment() {
  exec 9>"$DEPLOY_DIR/.deploy.lock"
  flock -w 600 9 || { echo 'Another DomainExp deployment is running.' >&2; exit 1; }
}
BACKEND_HOST_PORT="$(env_value BACKEND_HOST_PORT)"
export BACKEND_HOST_PORT
verify_local() {
  local host_port
  host_port="$(env_value BACKEND_HOST_PORT)"
  curl --fail --silent --show-error --connect-timeout 5 --max-time 10 \
    "http://127.0.0.1:$host_port/health" | python3 -c \
    'import json,sys; r=json.load(sys.stdin); assert r.get("status")=="ok" and r.get("service")=="domainpulse-api"'
  curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:$host_port/ready" >/dev/null
}
verify_public() {
  local headers
  headers="$(mktemp)"
  if ! curl --fail --silent --show-error --connect-timeout 10 --max-time 20 \
    -D "$headers" "https://$DOMAIN/health" | python3 -c \
    'import json,sys; r=json.load(sys.stdin); assert r.get("status")=="ok" and r.get("service")=="domainpulse-api"'; then
    rm -f -- "$headers"; return 1
  fi
  if ! grep -qi '^X-Domainexp-Backend: domainexp_app_backend' "$headers"; then
    rm -f -- "$headers"; echo 'Domain routes to an unexpected backend/config.' >&2; return 1
  fi
  rm -f -- "$headers"
}
