# Website feature parity audit

Checked against `apps/DomainExpMain/src/app`, its services, and the API controllers in `apps/api/src` on 22 October 2026. Website work is confined to `apps/web`; the mobile app, API, worker, and source project were not changed.

| Capability | Mobile app | Website |
| --- | --- | --- |
| Login, registration, Google sign in, account security | Mobile auth screens and services | Login, registration, Google sign in and link, password setup, security page. Server-side account deletion is unavailable. |
| Inventory: domains, servers, applications | Mobile tabs and detail pages | CRUD lists, detail pages, relationships, and metadata |
| Inventory: projects, provider accounts, email accounts, cloud resources | Mobile services and More screens | CRUD pages and the associated read models |
| Dashboard and recent activity | Dashboard and activity screen | Overview with all seven inventory counts, alert/connection health, and activity page. Missing Mongo summary counts are loaded through cursor pagination. |
| Domain research | Finder and domain detail | Finder, live WHOIS, DNS, SSL, historical WHOIS, TLD availability in one backend request for selected extensions, saved lookup history, and refresh for tracked domains |
| Monitoring and alerts | Alerts, monitoring, expiry reminders | Alert list and acknowledge, rules, domain monitoring, notification preferences/history, expiry registration, dry run and live check |
| Provider connections | Mobile provider sync and account settings | Backend provider connection create/validate/update/sync/disconnect, per-provider and Sync All actions, sync runs, and inventory associations. Saved provider accounts from the backend are listed separately, including app-created records without a connection. Reconnect creates a new provider account when the previous one is still linked to a disconnected connection. |
| Google Play Console and public Play Store | Mobile Google Play and application screens | Connect, verify, list, refresh, disconnect, sync published apps into inventory, and public developer/app search |
| Personal settings | Mobile More screen | Appearance, dashboard preferences, local portfolio/discovery preferences, data import/export, security, help |
| Platform mobile administration | Backend admin API | Role-gated control center for branding, feature flags, navigation, home layout, version policy, announcements, and audit log |
| Privacy policy | Public backend route | Linked from website Help and Security |

## Backend and platform limits

- The API exposes Expo/native device registration for push, but does not expose a Web Push VAPID subscription endpoint. The website can manage server-side notification settings and history; browser push cannot receive the same delivery until the backend supports it. The website shows this limitation in Settings.
- Mobile local test notifications and native notification deep links require native OS capabilities. The browser has equivalent navigation links in the notification history, but no Expo local notification API.
- Mobile can make some direct provider API requests on-device. The website uses the existing backend provider connection API and worker to keep credentials server-side. Provider sync equivalence needs an authenticated live test on the deployed API and worker; the repository currently contains a Mongo-backed API and a Postgres-backed worker.
- Mobile provider account creation falls back to phone storage when the API write fails, and its provider connection request ignores errors. Phone-only accounts and accounts in a different workspace cannot appear in this website session. The website now lists every page of backend provider accounts and distinguishes saved accounts from active connections. The app may place credentials in the provider account's external-account field; the website does not display or edit that field.
- A website user can now select a specific unlinked provider account saved by the app when connecting it. The credential must be entered again because the phone's local token storage is inaccessible to the browser. Existing disconnected backend connections still reserve their provider account, so they cannot be linked a second time through the current API.
- The backend has no persistent account profile edit, password change, or account deletion endpoint matching the mobile app's local settings. The website supports password setup, Google linking and browser preferences. It does not offer a fake server-side account deletion action.
- The mobile Billing modal displays a hardcoded plan and its payment button only shows a message; the Support ticket button similarly shows a success message without sending a ticket. The backend has no billing or ticket API, so the website cannot provide real billing or ticket submission through this backend.
- Registrar pricing, server TCP availability, and browser push lack matching API endpoints in this backend. The website labels its supported fallbacks and unavailable actions instead of claiming live backend data.
- `/mobile/config` and `/mobile/session` are native app bootstrap/session contracts. The website uses browser auth and exposes the admin side of mobile config at `/mobile-admin`; it does not create an Expo mobile session.
- Health and readiness are operations endpoints; they are not end-user features.

## Supplied APK check

- Inspected `C:\Users\amant\Downloads\DomainPulse.apk` as an Android package. Its bundled Hermes code includes the mobile navigation and feature labels for dashboard, domains, domain finder/details, servers, applications, alerts, recent activity, Google Play Console, provider connections, import/export, and security. These correspond to the mobile source flows listed above. Runtime screens and authenticated actions cannot be confirmed from a static APK scan.
- The APK bundle contains `https://app.domainexp.info/api/v1` and no `app.domainexprt.com` string. Current mobile source and the website target `https://app.domainexprt.com/api/v1`. The installed APK may therefore point to a different backend unless the old host redirects or the app uses a saved API override. The APK contains the **More → App Settings → DomainPulse Backend API → Current Endpoint** and **Save & Test Connection** controls; use those to confirm or set `https://app.domainexprt.com/api/v1`, then verify the same signed-in workspace before expecting its accounts to appear on the website.
- The website import now reads the mobile app's `Domain Name` CSV and tab-separated export, plain text domain lists, and a BIND zone's `$ORIGIN`. Only domain names are imported into the current website workspace; DNS records, phone-local provider credentials, and other device data are not migrated.

## Verification

- Website inventory list, detail, and summary GET responses use a 20-second in-memory cache. Writes, login/session changes, and workspace changes clear it; manual list reloads and provider-account connection checks fetch fresh data. Nothing is persisted to browser storage.
- Web typecheck and production Vite build pass.
- Web Vitest suite: 305 tests pass across 47 files, including the inventory cache, saved-account connection choice, Sync All, and mobile CSV/TSV/BIND import. The API-prefix assertion follows the configured URL in local and production modes.
- `http://localhost:5173` serves the signed-in app preview. `http://localhost:3001` serves the landing page in Next development mode.
- Authenticated VPS flows, real provider sync, Google OAuth, and admin mutations still require live credentials and a deployed frontend to verify end to end.
