#!/usr/bin/env bash
# Install the prebuilt frontend package on the existing DomainExp VPS.
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[[ "$EUID" == 0 && -s site/index.html ]] || {
  echo 'Run as root from the extracted frontend deployment package.' >&2; exit 1;
}
for tool in docker python3 curl flock sha256sum; do command -v "$tool" >/dev/null; done
mode="${WEB_DEPLOY_MODE:-setup}"
[[ "$mode" == setup || "$mode" == update ]]
# Share the backend's lock so its infrastructure snapshot cannot race replacement.
[[ -d /opt/domainexp-app/apps/api/deploy ]]
exec 8>/opt/domainexp-app/apps/api/deploy/.deploy.lock
flock -w 600 8
exec 9>/var/lock/domainexp-web.lock
flock -w 120 9
if [[ "$mode" == update ]]; then
  [[ "${WEB_RELEASE_SHA:-}" =~ ^[a-f0-9]{40}$ && "${WEB_RELEASE_NUMBER:-}" =~ ^[1-9][0-9]*$ ]]
  python3 - <<'PY'
import hashlib, json, os
from pathlib import Path
release = json.loads(Path('release.json').read_text())
assert release['commit'] == os.environ['WEB_RELEASE_SHA'], 'Release commit mismatch'
assert release['releaseNumber'] == os.environ['WEB_RELEASE_NUMBER'], 'Release number mismatch'
assert release['indexSha256'] == hashlib.sha256(Path('site/index.html').read_bytes()).hexdigest(), 'Build checksum mismatch'
PY
fi
central=gymproplus-nginx-1
backend=domainexp_app_backend
frontend=domainexp_web_frontend
docker exec "$central" nginx -t

# Discover existing infrastructure; never recreate the central proxy or backend.
python3 - <<'PY' > infrastructure.txt
import json, socket, subprocess
from pathlib import Path
nginx, api = json.loads(subprocess.check_output([
    'docker', 'inspect', 'gymproplus-nginx-1', 'domainexp_app_backend']))
for domain in ('domainexprt.com', 'www.domainexprt.com'):
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
    if path == '/etc/nginx/conf.d/domainexprt.com.conf':
        continue
    for names in re.findall(r'\bserver_name\s+([^;]+);', re.sub(r'#.*', '', body)):
        if {'domainexprt.com', 'www.domainexprt.com'} & set(names.split()):
            raise SystemExit(f'Domain already configured in {path}; inspect that route before deployment.')
PY
mapfile -t infra < infrastructure.txt
network="${infra[0]}"
config_dir="${infra[1]}"
cert_dir="${infra[2]}"
webroot="${infra[3]}"
target="$config_dir/domainexprt.com.conf"
[[ ! -L "$target" ]]
had_config=0
if [[ -e "$target" ]]; then
  grep -q '^# Managed exclusively by DomainExp web frontend deployment\.' "$target" || {
    echo 'Existing domain config has another owner; refusing overwrite.' >&2; exit 1;
  }
  cp -p -- "$target" previous-nginx.conf
  had_config=1
fi
if [[ "$mode" == update ]]; then
  [[ "$had_config" == 1 && -s "$cert_dir/live/domainexprt.com/fullchain.pem" ]] || {
    echo 'Run the one-time frontend setup before CI updates.' >&2; exit 1;
  }
fi
release="$(date -u +%Y%m%d%H%M%S)-$$"
image="domainexp-web:$release"
previous="domainexp_web_previous_$release"
had_frontend=0
new_frontend=0
if [[ -n "$(docker ps -aq --filter "name=^/$frontend$")" ]]; then
  [[ "$(docker inspect -f '{{index .Config.Labels "com.domainexp.service"}}' "$frontend")" == web ]] || {
    echo 'Existing frontend container has another owner; refusing replacement.' >&2; exit 1;
  }
  if [[ "$mode" == update ]]; then
    installed_number="$(docker inspect -f '{{index .Config.Labels "com.domainexp.ci-run"}}' "$frontend")"
    if [[ "$installed_number" =~ ^[0-9]+$ ]] && (( installed_number > WEB_RELEASE_NUMBER )); then
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
docker create --name "$frontend" --label com.domainexp.service=web \
  --label "org.opencontainers.image.revision=${WEB_RELEASE_SHA:-manual}" \
  --label "com.domainexp.ci-run=${WEB_RELEASE_NUMBER:-0}" \
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
if [[ ! -s "$cert_dir/live/domainexprt.com/fullchain.pem" ]]; then
  cat > "$target" <<'NGINX'
# Managed exclusively by DomainExp web frontend deployment.
server {
    listen 80;
    listen [::]:80;
    server_name domainexprt.com www.domainexprt.com;
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
# Certbot also repairs an existing certificate if its SANs lack www.
docker run --rm \
  --mount "type=bind,src=$cert_dir,dst=/etc/letsencrypt" \
  --mount "type=bind,src=$webroot,dst=/var/www/certbot" \
  certbot/certbot:v5.0.0 certonly --webroot -w /var/www/certbot \
  --cert-name domainexprt.com -d domainexprt.com -d www.domainexprt.com \
  --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring --expand
fi
install -m 644 domainexprt.com.conf "$target"
docker exec "$central" nginx -t
docker exec "$central" nginx -s reload

# Wait for DNS caches in Nginx to pick up the frontend replacement.
curl --fail --silent --show-error --retry 10 --retry-all-errors --retry-delay 2 \
  --connect-timeout 5 --max-time 15 https://domainexprt.com/login -o deployed-login.html
cmp -s site/index.html deployed-login.html
curl --fail --silent --show-error --max-time 15 https://domainexprt.com/domains -o deployed-route.html
cmp -s site/index.html deployed-route.html
[[ "$(curl --silent --show-error --max-time 15 -o /dev/null -w '%{http_code}' https://www.domainexprt.com/login)" == 301 ]]
curl --fail --silent --show-error --location --max-time 15 https://www.domainexprt.com/login -o deployed-www.html
cmp -s site/index.html deployed-www.html
curl --fail --silent --show-error --max-time 15 \
  -H 'Origin: https://domainexprt.com' https://domainexprt.com/api/v1/mobile/config \
  -o deployed-api.json
python3 -c 'import json; assert isinstance(json.load(open("deployed-api.json")), dict), "API route did not return JSON"'
curl --fail --silent --show-error --max-time 15 https://app.domainexprt.com/health \
  | python3 -c 'import json,sys; r=json.load(sys.stdin); assert r.get("status")=="ok" and r.get("service")=="domainpulse-api"'

# Surface configuration needed by browser auth without editing/restarting the API.
python3 - <<'PY'
import json, subprocess
api = json.loads(subprocess.check_output(['docker', 'inspect', 'domainexp_app_backend']))[0]
env = dict(item.split('=', 1) for item in api['Config']['Env'] if '=' in item)
origins = {item.strip() for item in env.get('CORS_ORIGINS', '').split(',')}
if 'https://domainexprt.com' not in origins:
    print('INFO: frontend uses same-origin /api/v1; no CORS change is needed for that route. Add the frontend origin to CORS_ORIGINS only if calling the API hostname directly.')
if env.get('GOOGLE_OAUTH_REDIRECT_URI') != 'https://domainexprt.com/auth/google/callback':
    print('ACTION NEEDED for Google sign-in: register/select https://domainexprt.com/auth/google/callback in backend and Google settings.')
PY

# One-time setup owns certificate renewal. CI never requests certificates or edits cron.
if [[ "$mode" == setup ]]; then
[[ ! -L /usr/local/sbin/domainexp-web-renew-ssl && ! -L /etc/cron.d/domainexp-web-ssl ]]
printf -v renew '#!/usr/bin/env bash\nset -Eeuo pipefail\ncert_dir=%q\nwebroot=%q\n' "$cert_dir" "$webroot"
printf '%s' "$renew" > /usr/local/sbin/domainexp-web-renew-ssl
cat >> /usr/local/sbin/domainexp-web-renew-ssl <<'RENEW'
exec 9>/var/lock/domainexp-web.lock
flock -w 120 9
before="$(sha256sum "$cert_dir/live/domainexprt.com/fullchain.pem")"
docker run --rm \
  --mount "type=bind,src=$cert_dir,dst=/etc/letsencrypt" \
  --mount "type=bind,src=$webroot,dst=/var/www/certbot" \
  certbot/certbot:v5.0.0 renew --cert-name domainexprt.com --webroot -w /var/www/certbot --quiet
after="$(sha256sum "$cert_dir/live/domainexprt.com/fullchain.pem")"
if [[ "$before" != "$after" ]]; then
  docker exec gymproplus-nginx-1 nginx -t
  docker exec gymproplus-nginx-1 nginx -s reload
fi
RENEW
chmod 700 /usr/local/sbin/domainexp-web-renew-ssl
printf '%s\n' '37 3,15 * * * root /usr/local/sbin/domainexp-web-renew-ssl >> /var/log/domainexp-web-ssl.log 2>&1' > /etc/cron.d/domainexp-web-ssl
chmod 644 /etc/cron.d/domainexp-web-ssl
fi
trap - ERR
echo 'SUCCESS: apps/web is live at https://domainexprt.com (www redirects here).'
echo 'Check sign-in/API access in your browser. Existing backend OAuth/CORS settings were not changed.'
if [[ "$had_frontend" == 1 ]]; then echo "Previous frontend retained for rollback: $previous"; fi
