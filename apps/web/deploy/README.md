# apps/web production deployment

Target: https://domainexprt.com, with www redirected to the canonical domain.
This deploys the Vite frontend in `apps/web`, using the existing API container.
The backend's existing `app.domainexprt.com` configuration stays in place.

## Automatic deployment

`.github/workflows/deploy-web.yml` validates frontend changes on pull requests
and deploys matching pushes to `main`. Manual dispatch deploys only when the
selected ref is `main`. Changes to other apps do not redeploy the frontend unless
the shared root dependency manifests change.

The build job installs locked dependencies with Node 24, runs deployment-package
tests and the entire frontend Vitest suite, typechecks/builds, and smoke-tests the
packaged Nginx image. Deployment cannot run after a failing check. The deploy job
downloads that exact artifact, verifies its SHA-256 locally and on the VPS, then
checks the embedded commit and build checksum before replacement.

It reuses the backend workflow's repository secrets `VPS_HOST`, `VPS_USER`,
`VPS_PORT`, `VPS_SSH_KEY`, and `VPS_KNOWN_HOSTS`. Expected target is
`root@200.234.45.233:22`; host-key checks remain strict. No frontend secret or
production environment file is uploaded with the static bundle.

CI invokes `install.sh` with `WEB_DEPLOY_MODE=update`, `WEB_RELEASE_SHA`, and
`WEB_RELEASE_NUMBER`. Update mode requires the already-installed owned domain
config and SSL certificate. It does not request certificates or rewrite renewal
jobs. It replaces only the frontend container, validates its own Nginx domain
config before reload, verifies SPA routes/www/API responses, and restores the
previous frontend/config if checks fail. Earlier CI runs cannot replace a newer
installed frontend run. The shared backend deployment lock serializes changes
with backend deployments so their protected-infrastructure checks cannot race.

The backend workflow validates `Api-Branch` and pull requests, while production
deployment runs only for `main`, matching its existing main-history requirement.
Frontend-only pushes do not restart the backend.

Activation requires committing and pushing these workflow/deployment files to
GitHub. A successful local test run does not verify repository secrets or SSH;
the first GitHub Actions run must pass before auto-deployment is confirmed.

## Prebuilt package

The local release bundle is `artifacts/domainexp-web.tar.gz`. It contains the
verified `apps/web/dist` build, a runtime Dockerfile, Nginx configuration, and
`install.sh`; it contains no server environment files or credentials.

Copy it from a **local Windows PowerShell** window:

```powershell
scp "E:\Worknai Projects\DomainExpMain\artifacts\domainexp-web.tar.gz" root@200.234.45.233:/root/
```

Then run in the existing **VPS SSH** session:

```bash
release_dir="$(mktemp -d /opt/domainexp-web-release.XXXXXXXX)"
tar -xzf /root/domainexp-web.tar.gz -C "$release_dir"
bash "$release_dir/install.sh"
```

The installer discovers the existing central proxy mounts and shared network,
refuses conflicting domain configs, builds only the static frontend container,
issues the root/www certificate, validates Nginx before reload, installs certificate
renewal, and verifies public login/deep-link responses. On failure it restores the
previous frontend container and domain config. It never restarts the backend.
Read any `ACTION NEEDED` messages for the existing backend's Google settings.
Certificate options follow the [Certbot user guide](https://eff-certbot.readthedocs.io/en/stable/using.html).

## Build

From the repository root on a Docker host:

```bash
docker build -f apps/web/Dockerfile -t domainexp-web:release .
```

The Dockerfile-specific ignore file includes only frontend source, public assets,
package manifests, and the public `.env.production`. Server environment files
are excluded. The build runs the existing TypeScript check and Vite build.

Production API requests use `/api/v1`. `VITE_LANDING_URL` is empty so signed-out
visitors see the frontend login rather than redirecting to the API hostname.

## Install on the existing VPS

First inspect the running `gymproplus-nginx-1` and `domainexp_app_backend`
containers. Identify their existing shared proxy network and central Nginx's
persistent mounts for `/etc/nginx/conf.d`, `/etc/letsencrypt`, and
`/var/www/certbot`. Use the configured `NGINX_PROXY_NETWORK` when it is set;
never use the private database network or recreate central Nginx.

After assigning `WEB_PROXY_NETWORK` to that existing shared proxy network:

```bash
docker run -d --name domainexp_web_frontend \
  --label com.domainexp.service=web --restart unless-stopped \
  --network "$WEB_PROXY_NETWORK" --network-alias domainexp_web_frontend \
  domainexp-web:release
docker inspect --format '{{.State.Health.Status}}' domainexp_web_frontend
```

No host port is published. If this frontend container already exists, inspect its
ownership and retain its image for rollback before replacing only that container.

Both DNS names must point to this VPS. Inspect existing root/www server blocks
before adding routes to avoid duplicate `server_name` entries. Serve HTTP-01
challenges for both names from the existing central ACME webroot, test Nginx,
then reload it. Obtain a certificate named `domainexprt.com` with SANs
`domainexprt.com` and `www.domainexprt.com` using that webroot and the existing
persistent certificate directory. Include this certificate in automatic renewal
with an Nginx reload after a successful renewal.

Once both the certificate and healthy frontend container exist, install
`domainexprt.com.conf` into the central config mount. Back up any existing owned
domain config first. Validate before a graceful reload:

```bash
docker exec gymproplus-nginx-1 nginx -t
docker exec gymproplus-nginx-1 nginx -s reload
curl -fsS -o /dev/null https://domainexprt.com/login
curl -fsS -o /dev/null https://domainexprt.com/domains
curl -I https://www.domainexprt.com/login
curl -fsS https://app.domainexprt.com/health
```

Check `/api/v1` in the browser network panel; API responses must be JSON rather
than SPA HTML. The default same-origin `/api/v1` route does not require CORS
permission; direct cross-origin calls to the API hostname would require the
frontend origin in the backend CORS allowlist. Google sign-in needs the frontend callback
`https://domainexprt.com/auth/google/callback` registered with Google and selected
by the backend's existing OAuth configuration. These settings require inspection
of the running backend; this frontend deployment does not change them.

## Verification status

The production TypeScript/Vite build and installer Bash syntax check passed
locally. The user ran the installer on the VPS on 2026-10-29; Docker build, Nginx
validation, certificate issuance, and public route checks completed successfully.
Independent HTTPS checks returned 200 for `/login`, a 301 redirect from www to
the canonical domain, JSON from `/api/v1/mobile/config`, and healthy API status
from the existing backend. Authenticated flows were not tested. Google sign-in
still needs its callback updated in the existing backend and Google configuration.

CI preparation: all 305 frontend tests, 16 backend deployment tests, package tests,
production build, Bash syntax, and actionlint checks passed locally. Obsolete
page tests were updated for the current portfolio-service boundary, Router
context, saved-account reconnection, and OAuth flow/copy. Application runtime
logic was not changed for the pipeline. Docker smoke tests run on the Ubuntu
CI runner; Docker is unavailable in the local Windows environment.
