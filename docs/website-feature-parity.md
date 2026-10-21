# Website feature parity audit

Checked against `apps/DomainExpMain/src/app`, its services, and the API controllers in `apps/api/src` on 21 October 2026. Website work is confined to `apps/web`; the mobile app, API, worker, and source project were not changed.

| Capability | Mobile app | Website |
| --- | --- | --- |
| Login, registration, Google sign in, account security | Mobile auth screens and services | Login, registration, Google sign in and link, password setup, account deletion, security page |
| Inventory: domains, servers, applications | Mobile tabs and detail pages | CRUD lists, detail pages, relationships, and metadata |
| Inventory: projects, provider accounts, email accounts, cloud resources | Mobile services and More screens | CRUD pages and the associated read models |
| Dashboard and recent activity | Dashboard and activity screen | Overview with all seven inventory counts, alert/connection health, and activity page. Missing Mongo summary counts are loaded through cursor pagination. |
| Domain research | Finder and domain detail | Finder, live WHOIS, DNS, SSL, historical WHOIS, TLD availability, saved lookup history, and refresh for tracked domains |
| Monitoring and alerts | Alerts, monitoring, expiry reminders | Alert list and acknowledge, rules, domain monitoring, notification preferences/history, expiry registration, dry run and live check |
| Provider connections | Mobile provider sync and account settings | Backend provider connection create/validate/update/sync/disconnect, sync runs, and inventory associations |
| Google Play Console and public Play Store | Mobile Google Play and application screens | Connect, verify, list, refresh, disconnect, sync published apps into inventory, and public developer/app search |
| Personal settings | Mobile More screen | Appearance, dashboard preferences, local portfolio/discovery preferences, data import/export, security, help |
| Platform mobile administration | Backend admin API | Role-gated control center for branding, feature flags, navigation, home layout, version policy, announcements, and audit log |
| Privacy policy | Public backend route | Linked from website Help and Security |

## Backend and platform limits

- The API exposes Expo/native device registration for push, but does not expose a Web Push VAPID subscription endpoint. The website can manage server-side notification settings and history; browser push cannot receive the same delivery until the backend supports it. The website shows this limitation in Settings.
- Mobile local test notifications and native notification deep links require native OS capabilities. The browser has equivalent navigation links in the notification history, but no Expo local notification API.
- Mobile can make some direct provider API requests on-device. The website uses the existing backend provider connection API and worker to keep credentials server-side. Provider sync equivalence needs an authenticated live test on the deployed API and worker; the repository currently contains a Mongo-backed API and a Postgres-backed worker.
- The backend has no persistent account profile edit or password change endpoint matching the mobile app's local settings. The website can edit browser preferences and use the backend's password setup and account deletion endpoints, but cannot persist a server-side profile/password change without a backend addition.
- Registrar pricing, server TCP availability, and browser push lack matching API endpoints in this backend. The website labels its supported fallbacks and unavailable actions instead of claiming live backend data.
- `/mobile/config` and `/mobile/session` are native app bootstrap/session contracts. The website uses browser auth and exposes the admin side of mobile config at `/mobile-admin`; it does not create an Expo mobile session.
- Health and readiness are operations endpoints; they are not end-user features.

## Verification

- Web typecheck and production Vite build pass.
- Web Vitest suite: 297 tests pass after the expiry registration test was added.
- `http://localhost:5173` serves the signed-in app. `http://localhost:3001` serves the existing static landing build because Next.js dependencies are unavailable in this workspace.
- Authenticated VPS flows, real provider sync, Google OAuth, and admin mutations still require live credentials and a deployed frontend to verify end to end.
