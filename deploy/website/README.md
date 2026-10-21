# DomainExp website deployment

The production URL is `https://domainexp.info`. The existing backend stays at
`https://app.domainexp.info`. A new central Nginx vhost serves the website at
the apex and forwards `/api/v1/*` to the already-running backend container.
No backend image, database, or backend vhost is replaced.

On the local machine, from the repository root:

```powershell
npm run build --workspace=@domainpulse/web
npm run build --workspace=@domainpulse/landing
New-Item -ItemType Directory -Force artifacts | Out-Null
tar.exe -czf artifacts/website-release.tar.gz apps/web/dist apps/landing/out deploy/website
```

Copy `artifacts/website-release.tar.gz` to the VPS after configuring SSH access.
Run `bash install.sh /path/to/website-release.tar.gz` as a user with Docker and
central Nginx mount access. This is a first-install script: it stops if an apex
vhost or website container already exists. It checks the current backend is
running, joins the existing proxy network, requests the apex HTTPS certificate
when needed, tests and reloads Nginx, and checks the public site and API.
An installation failure removes only the new website vhost/container.

Schedule `deploy/website/renew-ssl.sh` daily on the VPS after installation.
It renews only the `domainexp.info` certificate and reloads central Nginx;
the backend's separate certificate renewal stays unchanged.

The `apps/web/.env.production` and `apps/landing/.env.production` values are
included at build time. Rebuild the static assets if those URLs change.
