# Website integration

The website copied from `C:\WorknAi Project\Domain Manager` lives in `apps/landing` (public landing page) and `apps/web` (signed-in app). The API, database, worker, admin, and mobile code in this project remain separate.

## Local development

From this repository root, install dependencies with `npm install`, then run `npm run dev:frontend` to use the deployed VPS backend.

- Landing page: `http://localhost:3001`
- Signed-in app: `http://localhost:5173`
- API: `https://app.domainexp.info/api/v1` through Vite's local `/api/v1` proxy

The landing page links to the app on port 5173. `npm run dev:frontend` starts both frontends without starting a local API. `apps/web/.env.local` directs Vite's `/api/v1` proxy to the deployed VPS backend at `https://app.domainexp.info`. The browser uses the local same-origin path. To run the backend locally instead, set `VITE_API_PROXY_TARGET=http://127.0.0.1:4000` and run `npm run dev:site` with the existing API environment configured from `.env.example`.

## Production build

`npm run build` now includes both frontends. The landing page exports static files to `apps/landing/out`; Vite writes the app to `apps/web/dist`. Both production env files target `https://domainexp.info`: the landing page links to the app on the same host, and the app uses `/api/v1` on that host. The VPS frontend vhost must route `/api/v1/*` to the existing backend at `app.domainexp.info` or its existing Docker network address. These are public build-time values, not secrets; rebuild after changing them. The existing backend vhost can stay unchanged.

The current backend does not provide the source project's settings, live registrar pricing, server TCP availability, or browser push endpoints. The app stores General, Portfolio, and Domain Discovery preferences per user in this browser and identifies unavailable features in the UI. Its application probe uses this backend's existing GET endpoint for URLs without credentials, query parameters, or fragments. Provider sync capabilities fall back to the resource types implemented by this project's worker adapters.
