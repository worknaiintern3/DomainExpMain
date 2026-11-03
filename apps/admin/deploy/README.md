# Admin production deployment

Target: https://admin.domainexprt.com. DNS A record: `200.234.45.233`.
The existing `apps/admin` Vite app uses same-origin `/api/v1` requests, routed
to the existing `domainexp_app_backend:4000` by the central Nginx proxy.
No additional CORS or Google OAuth configuration is required for admin sign-in.

## Authentication prerequisite

Deploy the API authentication fix first using the existing **DomainExp production**
workflow. The former unauthenticated `POST /api/v1/admin/platform/session` issuer
has been removed. Admin users sign in with existing email/password credentials,
or provide an existing administrator access token through the app's sign-in dialog.
Regular users remain denied by the API's platform-role guard.

The installer checks the running API's compiled code before issuing any session
probe, and refuses to publish admin while the old token issuer remains installed.
This avoids accidentally creating a privileged session during a deployment check.
The API pipeline runs regression tests for anonymous, regular-user and admin access.

## CI/CD

`.github/workflows/deploy-admin.yml` validates matching pull requests and builds
and deploys matching pushes to `main`. Changes to admin, shared contracts or root
dependency manifests trigger this workflow. It reuses existing repository secrets
`VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_SSH_KEY` and `VPS_KNOWN_HOSTS`.
The target must be `root@200.234.45.233:22`; SSH host verification remains strict.

For the first installation, manually run **DomainExp admin production** on `main`
with `deployment_mode=setup` after the API fix succeeds. Setup installs only the
admin domain route, obtains its Let's Encrypt certificate through the existing
ACME webroot, and installs a dedicated certificate renewal job. A push before
setup correctly fails its deploy step without publishing an incomplete route.
Subsequent pushes use `update`, retaining the existing certificate and renewal job.

CI installs locked dependencies with Node 24, builds contracts and admin, validates
packaging and Bash syntax, and smoke-tests the packaged Nginx image. It uploads
that exact artifact and its SHA-256 checksum. The VPS verifies the archive,
embedded commit and index checksum before replacing only the owned admin container.
The Docker image's health, public root/deep routes, API JSON, anonymous admin
rejection and removal of the session issuer must all pass for deployment success.

The dedicated `domainexp_admin_frontend` container has no host ports and joins
only the existing shared proxy network. Deployment takes the backend deployment
lock and its own admin lock, validates central Nginx before graceful reload,
retains the previous admin container for rollback, and restores its prior route
and container if verification fails. Unrelated configs and certificates remain
owned by their existing deployments. Older CI run numbers cannot overwrite a
newer installed admin release during normal updates.

## Manual package

From the repository root:

```bash
npm run build --workspace=@domainpulse/contracts
npm run build --workspace=@domainpulse/admin
node apps/admin/deploy/package.mjs
```

The resulting `artifacts/domainexp-admin.tar.gz` contains only static assets and
deployment files, with no environment files or server credentials. Copy it to the
VPS, extract it into a new private release directory, and run `bash install.sh`
there as root for first setup. Normal automated updates should use GitHub Actions.

Renewal is managed by `/etc/cron.d/domainexp-admin-ssl`, invoking
`/usr/local/sbin/domainexp-admin-renew-ssl`. It renews only the admin certificate
and gracefully reloads Nginx only when the certificate changed and `nginx -t` passes.
