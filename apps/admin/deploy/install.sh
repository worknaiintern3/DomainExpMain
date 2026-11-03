#!/usr/bin/env bash
# Install the prebuilt frontend package on the existing DomainExp VPS.
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[[ "$EUID" == 0 && -s site/index.html ]] || {
  echo 'Run as root from the extracted frontend deployment package.' >&2; exit 1;
}
for tool in docker python3 curl flock sha256sum; do command -v "$tool" >/dev/null; done
mode="${ADMIN_DEPLOY_MODE:-setup}"
[[ "$mode" == setup || "$mode" == update ]]
# Share the backend's lock so its infrastructure snapshot cannot race replacement.
[[ -d /opt/domainexp-app/apps/api/deploy ]]
exec 8>/opt/domainexp-app/apps/api/deploy/.deploy.lock
flock -w 600 8
exec 9>/var/lock/domainexp-admin.lock
flock -w 120 9
if [[ "$mode" == update || -n "${ADMIN_RELEASE_SHA:-}${ADMIN_RELEASE_NUMBER:-}" ]]; then
  [[ "${ADMIN_RELEASE_SHA:-}" =~ ^[a-f0-9]{40}$ && "${ADMIN_RELEASE_NUMBER:-}" =~ ^[1-9][0-9]*$ ]]
  python3 - <<'PY'
import hashlib, json, os
from pathlib import Path
release = json.loads(Path('release.json').read_text())
assert release['commit'] == os.environ['ADMIN_RELEASE_SHA'], 'Release commit mismatch'
assert release['releaseNumber'] == os.environ['ADMIN_RELEASE_NUMBER'], 'Release number mismatch'
assert release['indexSha256'] == hashlib.sha256(Path('site/index.html').read_bytes()).hexdigest(), 'Build checksum mismatch'
PY
fi
central=gymproplus-nginx-1
backend=domainexp_app_backend
frontend=domainexp_admin_frontend
docker exec "$central" nginx -t

# Inspect code before probing: the vulnerable POST would itself create a session.
docker exec "$backend" node -e '
const fs = require("node:fs");
for (const file of ["admin-platform.controller.js", "mobile-admin.service.js"]) {
  const source = fs.readFileSync("/app/apps/api/dist/mobile-admin/" + file, "utf8");
  if (source.includes("getOrCreateAdminSession")) {
    console.error("Deploy the admin authentication fix to the API before publishing admin.");
    process.exit(1);
  }
}'

# Discover existing infrastructure; never recreate the central proxy or backend.
python3 - <<'PY' > infrastructure.txt
import json, socket, subprocess
from pathlib import Path
nginx, api = json.loads(subprocess.check_output([
    'docker', 'inspect', 'gymproplus-nginx-1', 'domainexp_app_backend']))
for domain in ('admin.domainexprt.com',):
    addresses = {row[4][0] for row in socket.getaddrinfo(domain, 443)}
    if addresses != {'200.234.45.233'}:
        raise SystemExit(f'{domain}: DNS must resolve only to 200.234.45.233; check A/AAAA records.')
shared = set(nginx['NetworkSettings']['Networks']) & set(api['NetworkSettings']['Networks'])
if len(shared) != 1:
    raise SystemExit('Expected one existing shared proxy network; inspect container networks first.')
network = shared.pop()
members = json.loads(subprocess.check_output(['docker', 'network', 'inspect', network]))[0]
if any(c.get('Name') == 'domainexp_app_postgres' for c in (members.get('Containers') or {}).values()):
    raise SystemExit('Refusing to attach frontend to a database network.')
print(network)
for destination in ('/etc/nginx/conf.d', '/etc/letsencrypt', '/var/www/certbot'):
    matches = [m['Source'] for m in nginx['Mounts'] if m['Destination'].rstrip('/') == destination]
    if destination == '/etc/nginx/conf.d' and not matches:
        matches = [m['Source'] + '/conf.d' for m in nginx['Mounts'] if m['Destination'].rstrip('/') == '/etc/nginx']
    if len(matches) != 1 or not Path(matches[0]).is_dir():
        raise SystemExit(f'Missing existing persistent mount: {destination}')
    print(matches[0])
# Check all loaded config files, including those outside conf.d.
import re
config = subprocess.check_output(['docker', 'exec', 'gymproplus-nginx-1', 'nginx', '-T'], stderr=subprocess.DEVNULL).decode()
for section in config.split('# configuration file ')[1:]:
    path, _, body = section.partition(':\n')
    if path == '/etc/nginx/conf.d/admin.domainexprt.com.conf':
        continue
    for names in re.findall(r'\bserver_name\s+([^;]+);', re.sub(r'#.*', '', body)):
        if 'admin.domainexprt.com' in names.split():
            raise SystemExit(f'Domain already configured in {path}; inspect that route before deployment.')
PY
mapfile -t infra < infrastructure.txt
network="${infra[0]}"
config_dir="${infra[1]}"
cert_dir="${infra[2]}"
webroot="${infra[3]}"
target="$config_dir/admin.domainexprt.com.conf"
[[ ! -L "$target" ]]
had_config=0
if [[ -e "$target" ]]; then
  grep -q '^# Managed exclusively by DomainExp admin frontend deployment\.' "$target" || {
    echo 'Existing domain config has another owner; refusing overwrite.' >&2; exit 1;
  }
  cp -p -- "$target" previous-nginx.conf
  had_config=1
fi
if [[ "$mode" == update ]]; then
  [[ "$had_config" == 1 && -s "$cert_dir/live/admin.domainexprt.com/fullchain.pem" ]] || {
    echo 'Run the one-time frontend setup before CI updates.' >&2; exit 1;
  }
fi
release="$(date -u +%Y%m%d%H%M%S)-$$"
image="domainexp-admin:$release"
previous="domainexp_admin_previous_$release"
had_frontend=0
new_frontend=0
if [[ -n "$(docker ps -aq --filter "name=^/$frontend$")" ]]; then
  [[ "$(docker inspect -f '{{index .Config.Labels "com.domainexp.service"}}' "$frontend")" == admin ]] || {
    echo 'Existing frontend container has another owner; refusing replacement.' >&2; exit 1;
  }
  if [[ -n "${ADMIN_RELEASE_NUMBER:-}" ]]; then
    installed_number="$(docker inspect -f '{{index .Config.Labels "com.domainexp.ci-run"}}' "$frontend")"
    if [[ "$installed_number" =~ ^[0-9]+$ ]] && (( installed_number > ADMIN_RELEASE_NUMBER )); then
      echo 'A newer frontend CI release is already installed; skipping this older run.'
      exit 0
    fi
  fi
fi
rollback() {
  local status=$?
  trap - ERR
  echo 'Frontend deployment failed; restoring its previous container and domain config.' >&2
  if [[ "$new_frontend" == 1 ]]; then docker rm -f "$frontend" || true; fi
  if [[ "$had_frontend" == 1 ]]; then
    docker rename "$previous" "$frontend" && docker start "$frontend" || true
  fi
  if [[ "$had_config" == 1 ]]; then
    cp -p -- previous-nginx.conf "$target"
  else
    rm -f -- "$target"
  fi
  if docker exec "$central" nginx -t; then docker exec "$central" nginx -s reload || true; fi
  exit "$status"
}
trap rollback ERR

# Build from the verified static bundle; no server npm install is needed.
docker build -t "$image" .
if [[ -n "$(docker ps -aq --filter "name=^/$frontend$")" ]]; then
  docker rename "$frontend" "$previous"
  had_frontend=1
  docker stop "$previous"
fi
docker create --name "$frontend" --label com.domainexp.service=admin \
  --label "org.opencontainers.image.revision=${ADMIN_RELEASE_SHA:-manual}" \
  --label "com.domainexp.ci-run=${ADMIN_RELEASE_NUMBER:-0}" \
  --restart unless-stopped --network "$network" --network-alias "$frontend" "$image"
new_frontend=1
docker start "$frontend"
healthy=0
for attempt in {1..30}; do
  if [[ "$(docker inspect -f '{{.State.Health.Status}}' "$frontend")" == healthy ]]; then healthy=1; break; fi
  sleep 2
done
[[ "$healthy" == 1 ]] || { echo 'Frontend failed its health check.' >&2; false; }

if [[ "$mode" == setup ]]; then
if [[ ! -s "$cert_dir/live/admin.domainexprt.com/fullchain.pem" ]]; then
  cat > "$target" <<'NGINX'
# Managed exclusively by DomainExp admin frontend deployment.
server {
    listen 80;
    listen [::]:80;
    server_name admin.domainexprt.com;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type text/plain;
        try_files $uri =404;
    }
    location / { return 503; }
}
NGINX
  docker exec "$central" nginx -t
  docker exec "$central" nginx -s reload
fi
# Obtain only the admin subdomain certificate in the existing certificate directory.
docker run --rm \
  --mount "type=bind,src=$cert_dir,dst=/etc/letsencrypt" \
  --mount "type=bind,src=$webroot,dst=/var/www/certbot" \
  certbot/certbot:v5.0.0 certonly --webroot -w /var/www/certbot \
  --cert-name admin.domainexprt.com -d admin.domainexprt.com \
  --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring --expand
fi
install -m 644 admin.domainexprt.com.conf "$target"
docker exec "$central" nginx -t
docker exec "$central" nginx -s reload

# Wait for DNS caches in Nginx to pick up the frontend replacement.
curl --fail --silent --show-error --retry 10 --retry-all-errors --retry-delay 2 \
  --connect-timeout 5 --max-time 15 https://admin.domainexprt.com/ -o deployed-login.html
cmp -s site/index.html deployed-login.html
curl --fail --silent --show-error --max-time 15 https://admin.domainexprt.com/domains -o deployed-route.html
cmp -s site/index.html deployed-route.html
curl --fail --silent --show-error --max-time 15 \
  -H 'Origin: https://admin.domainexprt.com' https://admin.domainexprt.com/api/v1/mobile/config \
  -o deployed-api.json
python3 -c 'import json; assert isinstance(json.load(open("deployed-api.json")), dict), "API route did not return JSON"'
curl --fail --silent --show-error --max-time 15 https://app.domainexprt.com/health \
  | python3 -c 'import json,sys; r=json.load(sys.stdin); assert r.get("status")=="ok" and r.get("service")=="domainpulse-api"'

# Real API responses must reject anonymous access, including the removed issuer.
[[ "$(curl --silent --show-error --max-time 15 -o deployed-denied.json -w '%{http_code}' https://admin.domainexprt.com/api/v1/admin/platform/stats)" == 401 ]]
python3 -c 'import json; assert isinstance(json.load(open("deployed-denied.json")), dict)'
[[ "$(curl --silent --show-error --max-time 15 -X POST -H 'Content-Type: application/json' --data '{}' -o deployed-session.json -w '%{http_code}' https://admin.domainexprt.com/api/v1/admin/platform/session)" == 404 ]]
python3 -c 'import json; r=json.load(open("deployed-session.json")); assert isinstance(r, dict) and "accessToken" not in r'

# One-time setup owns certificate renewal. CI never requests certificates or edits cron.
if [[ "$mode" == setup ]]; then
[[ ! -L /usr/local/sbin/domainexp-admin-renew-ssl && ! -L /etc/cron.d/domainexp-admin-ssl ]]
printf -v renew '#!/usr/bin/env bash\nset -Eeuo pipefail\ncert_dir=%q\nwebroot=%q\n' "$cert_dir" "$webroot"
printf '%s' "$renew" > /usr/local/sbin/domainexp-admin-renew-ssl
cat >> /usr/local/sbin/domainexp-admin-renew-ssl <<'RENEW'
exec 8>/opt/domainexp-app/apps/api/deploy/.deploy.lock
flock -w 600 8
exec 9>/var/lock/domainexp-admin.lock
flock -w 120 9
before="$(sha256sum "$cert_dir/live/admin.domainexprt.com/fullchain.pem")"
docker run --rm \
  --mount "type=bind,src=$cert_dir,dst=/etc/letsencrypt" \
  --mount "type=bind,src=$webroot,dst=/var/www/certbot" \
  certbot/certbot:v5.0.0 renew --cert-name admin.domainexprt.com --webroot -w /var/www/certbot --quiet
after="$(sha256sum "$cert_dir/live/admin.domainexprt.com/fullchain.pem")"
if [[ "$before" != "$after" ]]; then
  docker exec gymproplus-nginx-1 nginx -t
  docker exec gymproplus-nginx-1 nginx -s reload
fi
RENEW
chmod 700 /usr/local/sbin/domainexp-admin-renew-ssl
printf '%s\n' '47 4,16 * * * root /usr/local/sbin/domainexp-admin-renew-ssl >> /var/log/domainexp-admin-ssl.log 2>&1' > /etc/cron.d/domainexp-admin-ssl
chmod 644 /etc/cron.d/domainexp-admin-ssl
fi
trap - ERR
echo 'SUCCESS: apps/admin is live at https://admin.domainexprt.com.'
echo 'Check sign-in/API access in your browser. Existing backend OAuth/CORS settings were not changed.'
if [[ "$had_frontend" == 1 ]]; then echo "Previous frontend retained for rollback: $previous"; fi
