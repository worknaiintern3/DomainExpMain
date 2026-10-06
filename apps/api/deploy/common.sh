#!/usr/bin/env bash
set -Eeuo pipefail
DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(git -C "$DEPLOY_DIR" rev-parse --show-toplevel)"
export DEPLOY_DIR REPO_DIR
export DOMAIN=app.domainexp.info
export CENTRAL_NGINX=gymproplus-nginx-1
export CONTAINER=domainexp_app_backend
cd "$REPO_DIR"
[[ "$REPO_DIR" == /opt/domainexp-app && ! -L "$DEPLOY_DIR/.env" ]] || {
  echo 'Expected dedicated checkout /opt/domainexp-app and a regular production env file.' >&2; exit 1;
}
for command_name in docker git flock curl python3 ss; do command -v "$command_name" >/dev/null; done
docker compose version >/dev/null
[[ -f "$DEPLOY_DIR/.env" ]] || { echo 'Missing apps/api/deploy/.env' >&2; exit 1; }
umask 077
compose() {
  local files=(-f "$REPO_DIR/apps/api/docker-compose.prod.yml")
  if [[ -n "${NGINX_PROXY_NETWORK:-}" && -f "$REPO_DIR/apps/api/docker-compose.proxy.yml" ]]; then
    files+=(-f "$REPO_DIR/apps/api/docker-compose.proxy.yml")
  fi
  docker compose --project-name domainexp_app --env-file "$DEPLOY_DIR/.env" "${files[@]}" "$@"
}
env_value() {
  python3 "$DEPLOY_DIR/environment.py" "$DEPLOY_DIR/.env" value "$1"
}
prepare_runtime_environment() {
  python3 "$DEPLOY_DIR/environment.py" "$DEPLOY_DIR/.env" runtime
}
lock_deployment() {
  exec 9>"$DEPLOY_DIR/.deploy.lock"
  flock -w 600 9 || { echo 'Another DomainExp deployment is running.' >&2; exit 1; }
}
BACKEND_HOST_PORT="$(env_value BACKEND_HOST_PORT)"
NGINX_PROXY_NETWORK="$(env_value NGINX_PROXY_NETWORK)"
export BACKEND_HOST_PORT NGINX_PROXY_NETWORK
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
