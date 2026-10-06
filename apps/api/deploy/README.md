# DomainExp production

Dedicated checkout: `/opt/domainexp-app`. Domain: `https://app.domainexp.info`.
Backend: `domainexp_app_backend`, internal `0.0.0.0:4000`, host `127.0.0.1:5011`.

## Persistent infrastructure

Existing `domainexp_app_postgres` (`postgres:16-alpine`) and
`domainexp_app_pgdata` are external infrastructure. This application Compose file
never creates, replaces, removes or publishes PostgreSQL. The existing external
`domainexp_app_proxy` accepts only the exact backend and PostgreSQL containers.

Central `gymproplus-nginx-1` retains its containers, mounts and networks.
If authorized, set `NGINX_PROXY_NETWORK` to its existing proxy network. The
optional Compose override attaches only the backend to that shared proxy network;
Nginx is never attached to the private PostgreSQL network. Leaving this variable
unset does not grant permission to modify any unrelated network.

## Production configuration

Keep `apps/api/deploy/.env` on the VPS only. It is ignored, never printed, and
normal deployment does not rewrite it. `.env.example` lists required values.
Preflight reports invalid/missing names, including required Google OAuth fields.
Do not use fake OAuth credentials to bypass startup validation.

Both database URLs target `domainexp_app_postgres:5432` and the same database.
`RUN_MIGRATIONS=true` enables the controlled committed Drizzle migrations.
Use a schema-owner `MIGRATION_DATABASE_URL` and a separate runtime `DATABASE_URL`
with no SUPERUSER/BYPASSRLS or table ownership. The owner URL is stripped from the
backend's generated `.env.runtime`. If the newly initialized database currently
uses its owner for both URLs, run this explicit one-time setup:

```bash
python3 apps/api/deploy/setup-runtime-role.py --initialize-runtime-role
```

It creates a new restricted login and changes only DATABASE_URL. It never resets
an existing role's password, migration credentials, JWT or encryption secrets.
Never call this initializer from normal CI.

## One-time HTTPS setup

DNS must resolve only to `200.234.45.233`. Central Nginx must already have its
persistent conf.d, certificate and ACME webroot mounts. This setup takes no host
ports and modifies only the DomainExp domain config and certificate:

```bash
bash apps/api/deploy/setup-https.sh
```

It serves HTTP-01 through the existing central webroot, obtains this domain's
certificate, installs its exact HTTP/HTTPS blocks, tests Nginx before graceful
reload, and schedules only this certificate's renewal in
`/etc/cron.d/domainexp-app-ssl`. Existing certificates and configs are retained.
Renewal reloads Nginx only if the certificate changed and `nginx -t` succeeds.
The ACME account is registered without an email; expiry alerts are unavailable.

Application health is still required separately. Set real OAuth configuration
and the explicitly authorized proxy-network setting before expecting CI success.
For an already installed certificate, `install-nginx.sh` installs only this
managed domain config after backend readiness and shared proxy connectivity.

## Push deployment

Set GitHub secrets VPS_HOST, VPS_USER, VPS_PORT, VPS_SSH_KEY, VPS_KNOWN_HOSTS and
DEPLOY_PATH for the specified target. SSH host verification remains strict.
Push `main` or dispatch the workflow manually. Actions checks out the triggering
SHA, validates deployment tests, buffers that revision's deployment script into
a private temporary remote file, and runs the single deployment implementation.
This lets a new fix run even when the server's old preflight is broken.

The deployment lock serializes migration and replacement. The script fetches
main, verifies the requested SHA is in its history, checks out that exact SHA,
checks ownership/configuration, snapshots protected infrastructure, builds,
validates compiled runtime parsers, runs committed migrations once, and replaces
only the backend. A newer main revision does not change the requested commit.

Success requires Docker readiness, local /health and /ready, and verified public
HTTPS /health with the backend identity header. Normal CI never bypasses public
health, changes Nginx or installs certificates. DOMAINEXP_INITIAL_SETUP is for
explicit first setup only. PostgreSQL, .env, Nginx and existing container
identities/mounts/network/start times are verified after application deployment.

## Failure and rollback

Failures remain nonzero in GitHub Actions. Diagnostics redact production values
and connection URLs. Application replacement failures restore the retained
previous image using only the backend service; a failed first revision is removed
by service name. Git checkout is restored. There is no Compose down, orphan
removal, global prune, database restart/reset, or destructive schema rollback.
Applied migrations remain applied, so releases must keep rollback compatibility.

API base URL: `https://app.domainexp.info/api/v1`.
