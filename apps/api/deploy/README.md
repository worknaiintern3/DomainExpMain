# DomainExp production — existing central Nginx

Domain: https://app.domainexp.info → 200.234.45.233.
Container: domainexp_app_backend; internal port: 4000.
Compose project/image/network prefix: domainexp_app.
Only central gymproplus-nginx-1 owns host 80/443. This project publishes a
selected BACKEND_HOST_PORT on 127.0.0.1 only. Central Nginx reaches the backend
on the dedicated domainexp_app_proxy network, which the installer connects once.

## First VPS setup only

Required: Docker Compose v2.20+, Git, Bash, Python 3, curl, ss, flock.
Use a dedicated checkout with GitHub read access:

```bash
git clone https://github.com/worknaiintern3/DomainExpMain.git /opt/domainexp-app
cd /opt/domainexp-app
cp apps/api/deploy/.env.example apps/api/deploy/.env
chmod 600 apps/api/deploy/.env
ss -ltn
docker ps --format 'table {{.Names}}\t{{.Ports}}'
nano apps/api/deploy/.env
```

Choose an actually free BACKEND_HOST_PORT (1024–65535), not 80/443.
Fill the real frontend CORS_ORIGINS, private/managed PostgreSQL URL, JWT signing
secret (32 random bytes, base64url), a separate provider encryption key
(32 bytes, standard base64), and Google OAuth credentials/real frontend callback.
Preserve existing encryption keys. No database ports are published.
RUN_MIGRATIONS defaults to false. For verified Drizzle migrations, back up/review
the DB, provide the separate schema-owner MIGRATION_DATABASE_URL, and explicitly
set RUN_MIGRATIONS=true when needed. No reset/seeding occurs; schema changes
cannot be reversed by application rollback. The API's generated .env.runtime
does not receive the migration-owner URL. Keep the runtime DB role non-owner,
without SUPERUSER/BYPASSRLS.

Commit/push the deployment files first; on the VPS:

```bash
bash apps/api/deploy/preflight.sh
DOMAINEXP_INITIAL_SETUP=1 bash apps/api/deploy/deploy.sh
```

Initial mode verifies the backend only and leaves public installation pending;
GitHub never enables this mode.

## First SSL and Nginx setup

DNS A: app.domainexp.info → 200.234.45.233. Remove incorrect AAAA records.
First installation requires direct DNS rather than a CDN proxy.
Obtain ONLY this domain's certificate through the existing central certificate
setup. Reuse a valid existing certificate. Never stop central Nginx, replace
other certificates, or run standalone Certbot with host ports 80/443.

If the existing central certificate store has a directory mount at
/etc/letsencrypt, this DNS-01 command takes no public port:

```bash
CERT_STORE=$(docker inspect gymproplus-nginx-1 | python3 -c 'import json,sys; m=[m for m in json.load(sys.stdin)[0]["Mounts"] if m["Destination"]=="/etc/letsencrypt"]; assert len(m)==1,"Find the central certificate directory mount first"; print(m[0]["Source"])')
docker run --rm -it --name domainexp_app_certbot \
  --mount "type=bind,src=$CERT_STORE,dst=/etc/letsencrypt" \
  certbot/certbot:v5.0.0 certonly --manual --preferred-challenges dns \
  --cert-name app.domainexp.info -d app.domainexp.info
```

Follow the TXT challenge. Manual DNS certificates do NOT auto-renew: configure
this domain in the existing central automated renewal system or its DNS-provider
plugin before unattended operation. The DNS provider/central renewal mechanism
was not supplied, so no credentials or plugin are guessed.

Once the certificate is visible in central Nginx:

```bash
bash apps/api/deploy/install-nginx.sh
curl --fail https://app.domainexp.info/health
```

The installer finds the existing persistent directory mount for conf.d, checks
DNS, certificates, exact routing and duplicates, backs up a previously managed
same-name file, copies ONLY app.domainexp.info.conf, tests Nginx and gracefully
reloads it. Validation failure restores the file without reloading broken
config. Existing domain files are not rewritten. An unknown same-name file is
refused. If central Nginx has only individual file mounts and no persistent
writable conf.d directory, installation fails safely; it never recreates it.

## GitHub secrets

VPS_HOST=200.234.45.233
VPS_USER=<SSH user with Docker and dedicated checkout access>
VPS_SSH_KEY=<dedicated automation private key>
VPS_PORT=<SSH port; defaults to 22>
DEPLOY_PATH=/opt/domainexp-app
VPS_KNOWN_HOSTS=<verified OpenSSH host-key line>

Install the automation public key in the user's authorized_keys. The VPS must
also have read access to origin; a private repo needs its own read-only deploy
key. Verify host-key fingerprints through a trusted console. A nonstandard port
uses [200.234.45.233]:PORT in known_hosts.

## Normal deployment

```bash
git add .
git commit -m "update"
git push origin main
```

Only push to main triggers .github/workflows/deploy-production.yml.
It SSHs to the VPS and runs ONE deployment script with the pushed commit SHA.
The script refuses dirty source or a mismatched origin/main revision; locking
serializes deployments. Preflight checks port/container/project/network ownership,
domain collisions and central Nginx. Only this project is built/replaced.
Normal push deployment never writes/reloads Nginx. Docker health, local health
and DB readiness, public HTTPS backend identity and previously running unrelated
containers are checked. Single-container replacement may briefly interrupt this
backend. The root development Compose file and other apps are untouched.

## Verify and rollback

```bash
curl --fail https://app.domainexp.info/health
docker inspect -f '{{.State.Health.Status}}' domainexp_app_backend
docker logs --tail 100 domainexp_app_backend
```

Failures reset only this dedicated checkout to its prior commit, restore its
retained previous image and verify old local readiness. GitHub remains failed.
There is no previous backend on first deployment. Images are never globally
pruned. Manual recovery: inspect apps/api/deploy/.previous-commit and the failure,
then restore its retained image through the same production Compose file;
never roll back database migrations or stop unrelated projects.

API base URL: https://app.domainexp.info/api/v1.
Production disables the unauthenticated development mobile/session helper;
mobile clients need password/OAuth login. Live Docker/VPS/SSL checks require
server access; local shell/static checks do not establish live readiness.
