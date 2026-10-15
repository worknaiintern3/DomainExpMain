# Google Play Console Account Connection & App Discovery Setup

This document provides complete instructions for configuring Google Cloud, Google Play Console, backend environment variables, and mobile client workflows for customer-isolated Google Play Developer account linking and app discovery in DomainPulse.

---

## 1. Overview & Architecture

DomainPulse connects customer Google accounts to their Google Play Console developer accounts using official Google APIs:
- **Google OAuth 2.0 (Authorization Code with PKCE)**: Obtains user authorization with offline refresh tokens.
- **Google Play Developer API (Android Publisher v3)**:
  - User verification: `developers/{developer}/users/{email}`
  - Account users & grants: `developers/{developer}/users`
  - Per-app grants: `developers/{developer}/users/{email}/grants/{packageName}`
  - Verified app listings: `applications/{packageName}/edits/{editId}/listings`
  - Canonical Play Store URL: `https://play.google.com/store/apps/details?id={packageName}`

### Security & SaaS Tenant Isolation
- **Strict Customer Isolation**: Every query to `/api/google-play/apps` is bound directly to the authenticated application user (`request.authPrincipal.userId`). Customer A can never see or access Customer B's connections or apps. Query parameters like `?userId=` are strictly rejected.
- **Credential Protection**: Client secrets, access tokens, and refresh tokens are **never** exposed to the mobile app or browser. Tokens are encrypted at rest using **AES-256-GCM** in PostgreSQL and decrypted in memory only during authorized API operations.
- **No Scraping or Fabricated Endpoints**: The implementation uses strictly official Google Play Developer API endpoints and never scrapes search engines or assumes non-existent endpoints like `GET /apps`.

---

## 2. Google Cloud Configuration

### Step 2.1: Create or Select a Google Cloud Project
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `DomainPulse-Production` or `DomainPulse-Dev`) or select your existing project.

### Step 2.2: Enable Google Play Developer API
1. In the Google Cloud Console, open **APIs & Services > Library**.
2. Search for **Google Play Android Developer API** (also known as `androidpublisher`).
3. Click **Enable**.
- Official Documentation: [Google Play Developer API Overview](https://developers.google.com/android-publisher)

### Step 2.3: Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Select User Type (**External** for SaaS multi-tenant customers).
3. Fill in App Information:
   - App name: `DomainPulse`
   - User support email: your support email
   - Developer contact email: your technical email
4. Under **Scopes**, click **Add or Remove Scopes** and add:
   - `https://www.googleapis.com/auth/androidpublisher` (View and manage Google Play developer accounts)
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`

### Step 2.4: Create OAuth 2.0 Credentials
1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Choose Application Type: **Web application**.
4. Configure Authorized redirect URIs:
   - Development: `http://localhost:4000/api/v1/google-play/callback` (and `http://127.0.0.1:4000/api/v1/google-play/callback`)
   - Production: `https://api.domainpulse.com/api/v1/google-play/callback`
5. Note your **Client ID** and **Client Secret**. Keep the secret safe on the server only.

---

## 3. Google Play Console Permissions

For a customer's Google account to access a Play Console developer account:

### Step 3.1: Developer Account ID
The Google Play Developer API requires a developer account identifier: `developers/{developer}`.
- To find the Developer Account ID:
  1. Open [Google Play Console](https://play.google.com/console).
  2. The Developer Account ID is the numeric ID visible in the URL bar:
     `https://play.google.com/console/developers/{DEVELOPER_ACCOUNT_ID}/app-list`
  3. Alternatively, click **Developer account > Account details** to view the Developer ID.

### Step 3.2: User Grants & Permissions
The connecting Google account must have active, non-expired access to the developer account:
1. In Google Play Console, go to **Users and permissions**.
2. Ensure the customer's Google email has **ACCESS_GRANTED** status (invitation accepted).
3. The customer must have either:
   - **Account-level permissions**: `CAN_VIEW_NON_FINANCIAL_DATA_GLOBAL` (allows viewing app info across all apps in the account), OR
   - **Per-app grants**: Specific apps assigned with `CAN_VIEW_NON_FINANCIAL_DATA` (or edit/manage permissions).
- Official References:
  - [Google Play Users Resource](https://developers.google.com/android-publisher/api-ref/rest/v3/users)
  - [Google Play Grants Resource](https://developers.google.com/android-publisher/api-ref/rest/v3/grants)

---

## 4. Environment Variables

Configure the following environment variables in your server `.env` file (or secret manager):

```env
# Google OAuth 2.0 Credentials (Server-only)
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret
GOOGLE_PLAY_REDIRECT_URI=http://localhost:4000/api/v1/google-play/callback

# Versioned AES-256-GCM Token Encryption Key
# Generate a 32-byte base64 key: node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
GOOGLE_PLAY_ENCRYPTION_KEY=your-32-byte-base64-encryption-key
```

> **Security Note:** Never add `GOOGLE_OAUTH_CLIENT_SECRET`, refresh tokens, or encryption keys into Expo (`apps/DomainExpMain`), client bundles, or version control.

---

## 5. Backend API Endpoints

All endpoints are hosted on the existing Node.js Fastify / NestJS backend under `/api/v1/google-play` (with an automatic rewrite supporting `/api/google-play`):

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/google-play/status` | Bearer JWT | Returns connection status for authenticated user (`connected`, `googleAccount`, `developerAccount`) |
| `GET` | `/api/google-play/apps` | Bearer JWT | Returns customer-isolated authorized apps from Google Play Developer API |
| `POST` | `/api/google-play/verify-account` | Bearer JWT | Verifies customer's Play Console Developer Account ID against Google Play API |
| `POST` | `/api/google-play/refresh` | Bearer JWT | Refreshes Google OAuth access token using encrypted refresh token |
| `POST` | `/api/google-play/disconnect` | Bearer JWT | Removes Google Play connection and encrypted tokens for authenticated user |
| `GET` | `/api/google-play/auth` | Bearer / Query | Initiates OAuth flow, returns `{ authUrl, state }` with PKCE challenge |
| `GET` | `/api/google-play/callback` | Public OAuth | Handles Google redirect, exchanges code, encrypts tokens, and redirects to app |

### Example Response: `GET /api/google-play/apps`
```json
{
  "success": true,
  "developerAccount": {
    "id": "1234567890123456789"
  },
  "googleAccount": {
    "email": "customer@example.com"
  },
  "apps": [
    {
      "packageName": "com.company.gympro",
      "appName": "GymPro",
      "playStoreUrl": "https://play.google.com/store/apps/details?id=com.company.gympro"
    }
  ]
}
```

---

## 6. How Customer Connects & Discovers Apps

1. **Step 1: Open Google Play Console Screen**
   - In the mobile app, tap **Play Console** from the Applications tab or **+ Connect** on Google Play Console in Settings.
2. **Step 2: Enter Developer Account ID & Continue with Google**
   - The user enters their Play Console Developer Account ID (or enters it right after authentication).
   - Taps **[ Continue with Google ]**.
3. **Step 3: Google Consent**
   - `WebBrowser.openAuthSessionAsync` opens Google OAuth screen requesting `https://www.googleapis.com/auth/androidpublisher`.
   - Customer selects their Google account and grants consent.
4. **Step 4: Verification & Authorization Check**
   - Backend exchanges the authorization code for tokens, encrypts the access and refresh tokens, and contacts Google Play Developer API:
     `GET https://androidpublisher.googleapis.com/androidpublisher/v3/developers/{developerAccountId}/users/{email}`
   - The backend checks:
     - `accessState == 'ACCESS_GRANTED'`
     - Extracts authorized package names from `grants[]`.
     - Handles account-level permission `CAN_VIEW_NON_FINANCIAL_DATA_GLOBAL`.
   - If user does not have Play Console access or access is expired (`INVITATION_EXPIRED`), access is denied with a user-friendly error.
5. **Step 5: App Discovery**
   - For each verified package, the backend queries official Google Play listings (`applications/{packageName}/edits/.../listings`) for the app title.
   - Clean app cards are rendered on mobile with verified package names and **[ Open Play Store ]** buttons.

---

## 7. Current Google API Limitations & Edge Cases

1. **No Automatic Developer Account ID Discovery**:
   - Google OAuth tokens with the `androidpublisher` scope do not expose an endpoint to list all developer account IDs belonging to an OAuth user (there is no `GET /accounts` or `GET /developers`).
   - *DomainPulse Solution*: Secure onboarding step where the customer supplies their Developer Account ID, and the backend verifies that the authenticated user actually exists and has `ACCESS_GRANTED` on `developers/{developerAccountId}/users/{email}`.
2. **Account Owners with Global Permissions**:
   - In some developer accounts, account owners or super-admins have `CAN_VIEW_NON_FINANCIAL_DATA_GLOBAL` and their `partial: true` flag may be set with empty individual grants.
   - *DomainPulse Solution*: When `CAN_VIEW_NON_FINANCIAL_DATA_GLOBAL` is present, DomainPulse queries `developers/{developerAccountId}/users` to collect all known package grants across the developer account.
3. **App Listing Permissions**:
   - If an app has restricted permissions or lacks localized English store listings, the API fallback uses the verified `packageName` without fabricating app names.
4. **Offline Access & Refresh Tokens**:
   - Google only returns a `refresh_token` when `access_type=offline` and `prompt=consent` are included in the authorization request. DomainPulse includes both flags automatically.

---

## 8. Startup & Verification Commands

### Backend Startup
```bash
# Build contracts and database
npm run build --workspace=@domainpulse/contracts
npm run build --workspace=@domainpulse/database

# Run API typecheck and tests
npm run typecheck --workspace=@domainpulse/api
npx vitest run test/google-play.service.spec.ts
```

### Mobile Startup
```bash
# Run Expo mobile client
cd apps/DomainExpMain
npx expo start
```
