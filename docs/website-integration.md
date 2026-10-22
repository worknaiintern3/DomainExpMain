# Website integration

The website copied from `C:\WorknAi Project\Domain Manager` lives in `apps/landing` (public landing page) and `apps/web` (signed-in app). The API, database, worker, admin, and mobile code in this project remain separate.

## Local development

From this repository root, install dependencies with `npm install`, then run `npm run dev:frontend` to use the deployed VPS backend.

- Landing page: `http://localhost:3001`
- Signed-in app: `http://localhost:5173`
- API: `https://app.domainexprt.com/api/v1` from the browser

The landing page links to the app on port 5173. `npm run dev:frontend` starts both frontends without starting a local API. `apps/web/.env.development` points the browser directly at the deployed VPS backend; the backend allows `http://localhost:5173` as an origin. To run the backend locally instead, set `VITE_API_BASE_URL=/api/v1` and `VITE_API_PROXY_TARGET=http://127.0.0.1:4000` in `apps/web/.env.local`, then run `npm run dev:site` with the existing API environment configured from `.env.example`.

## Production build

`npm run build` includes both frontends. The landing page exports static files to `apps/landing/out`; Vite writes the signed-in app to `apps/web/dist`. Both production builds target `https://app.domainexprt.com`. The app calls `/api/v1` on that same host, so browser API requests do not need cross-origin access. These are public build-time values; rebuild after changing them.

Before building the landing page for VPS deployment, remove any local `NEXT_PUBLIC_APP_URL=http://localhost:5173` override from `apps/landing/.env.local` or set `NEXT_PUBLIC_APP_URL=https://app.domainexprt.com` explicitly for the build. Local overrides take precedence over `.env.production`; a build with the localhost override must not be deployed.

The current `app.domainexprt.com` Nginx vhost proxies **every** path to the backend. The website will not appear at this host until its VPS routing serves the landing export at `/`, the web app at `/login`, `/register`, `/auth/google/callback` and authenticated app routes, and keeps `/api/v1`, `/health`, `/ready`, `/privacy` and `/privacy-policy` on the existing backend. Preserve the backend routes when adding the frontend; changing these repository URLs alone does not deploy the website.

The current backend does not provide the source project's settings, live registrar pricing, server TCP availability, or browser push endpoints. The app stores General, Portfolio, and Domain Discovery preferences per user in this browser and identifies unavailable features in the UI. Its application probe uses this backend's existing GET endpoint for URLs without credentials, query parameters, or fragments. Provider sync capabilities fall back to the resource types implemented by this project's worker adapters.
