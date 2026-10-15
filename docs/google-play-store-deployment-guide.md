# DomainPulse — Google Play Store Deployment & Store Listing Guide

This guide contains everything required to deploy **DomainPulse** on Google Play Console, including pre-generated assets, store listing texts, questionnaire responses, and build instructions.

---

## 1. Ready-to-Upload Store Assets

All required store graphics have been generated and saved to:
`apps/DomainExpMain/assets/play-store/`

| Asset Type | File Name | Required Dimensions | Purpose |
| :--- | :--- | :--- | :--- |
| **App Icon** | `play_store_icon_512x512.png` | **512 x 512 px** | Main app icon displayed on the Play Store |
| **Feature Graphic** | `feature_graphic_1024x500.jpg` | **1024 x 500 px** | Top promotional showcase banner on the store listing |
| **Screenshot 1** | `screenshot_1_dashboard.jpg` | **9:16 Portrait** | Infrastructure overview, health score & telemetry KPI cards |
| **Screenshot 2** | `screenshot_2_domains.jpg` | **9:16 Portrait** | Domain portfolio, SSL expiry countdown & DNS status |
| **Screenshot 3** | `screenshot_3_servers.jpg` | **9:16 Portrait** | Cloud server monitoring (CPU, RAM, latency & node uptime) |
| **Screenshot 4** | `screenshot_4_apps.jpg` | **9:16 Portrait** | Google Play Console integration & mobile app health |

---

## 2. Store Listing Metadata (Copy & Paste)

### App Name (Max 30 characters)
```
DomainPulse - Domain & Cloud
```
*(Or: `DomainPulse: Cloud Monitor`)*

### Short Description (Max 80 characters)
```
Monitor domains, SSL certificates, cloud VPS servers & Google Play apps live.
```

### Full Description (Up to 4,000 characters)
```
DomainPulse is the ultimate multi-cloud infrastructure and domain intelligence platform designed for developers, DevOps engineers, and digital agencies. Keep your entire web footprint healthy, secure, and always online from a single, unified mobile dashboard.

KEY CAPABILITIES:

🌐 SMART DOMAIN & SSL MONITORING
• Real-time WHOIS status, registrar synchronization, and DNS record diagnostics.
• Automated SSL expiration countdowns and renewal alerts (Let's Encrypt, Cloudflare, DigiCert, ZeroSSL).
• Instant push notifications before critical domains expire.

🖥️ CLOUD SERVERS & VPS TELEMETRY
• Live monitoring for Hostinger, AWS, DigitalOcean, Hetzner, Vultr, Linode, and custom Linux servers.
• Real-time telemetry tracking CPU load, memory utilization, disk space, and ping latency.
• Server reboot, maintenance, and connection health status checks.

▶️ OFFICIAL GOOGLE PLAY CONSOLE SYNC
• Connect your Play Console account securely via official Google OAuth.
• Monitor published apps, in-review updates, and rejected release tracks.
• Track version codes, ratings, and live Google Play store status in real-time.

⚡ INSTANT HEALTH CHECKS & PROBING
• Low-latency HTTP/HTTPS probing with response time tracking.
• Instant alerts on downtime, certificate expirations, or server failures.
• Complete tenant privacy and encrypted credential management.

Take control of your cloud portfolio. Download DomainPulse today and never let a domain expire or server go down unnoticed!
```

---

## 3. Categorization & Contact Details

- **Application Type**: App
- **Category**: Productivity / Tools / Business
- **Tags**: Developer Tools, Cloud Computing, System Utilities, Monitoring, Domain Name
- **Developer Email**: `support@domainpulse.io` (or your company email)
- **Privacy Policy URL**: `https://app.domainexp.info/privacy` (Served directly from live backend, or host `docs/privacy-policy.html`)
- **Live Backend Server**: `https://app.domainexp.info` (API base: `https://app.domainexp.info/api/v1`)
- **Health Check Endpoint**: `https://app.domainexp.info/health` (Status: Healthy `{"status":"ok"}`)

---

## 4. App Content & Data Safety Questionnaire Checklist

When completing the Google Play Console **App Content** section:

1. **Privacy Policy**: Enter your privacy policy URL.
2. **Ads**: Select **"No, my app does not contain ads"**.
3. **App Access**:
   Select **"All or some functionality is restricted"** and click **+ Add instructions**:
   - **User name / Email**: `test@domainpulse.io` (or `vrd@gmail.com`)
   - **Password**: `Password123!`
   - **Explanation**: `Testing credentials for Google Play Review team to access and inspect DomainPulse cloud & domain monitoring.`
4. **Target Audience**: Select **"18 and over"** (avoids strict Families Policy requirements).
5. **Data Safety**:
   - **Data collected**:
     - *Personal info*: Email address (for account login and notifications).
     - *App activity*: App interactions (for analytics/monitoring).
   - **Data encrypted in transit**: Yes (HTTPS / TLS 1.3).
   - **Data deletion request**: Provide URL or email where users can request account deletion.
6. **Government Apps**: Select **"No"**.
7. **Financial Features**: Select **"My app does not provide financial features"**.

---

## 5. Build and Release Instructions

### Step 1: Create Production AAB (Android App Bundle)

From your terminal in `apps/DomainExpMain`:

```bash
# Option A: EAS Cloud Build (Easiest)
npx eas-cli login
npx eas-cli build --platform android --profile production

# Option B: Local Gradle Build
npx expo prebuild --platform android
cd android
.\gradlew bundleRelease
```

The output file is `app-release.aab` (or downloaded directly from EAS).

### Step 2: Upload to Google Play Console

1. Open [Google Play Console](https://play.google.com/console).
2. Click **Create app**:
   - App name: `DomainPulse - Domain & Cloud`
   - Default language: English (United States)
   - App or game: App
   - Free or paid: Free
3. Navigate to **Grow** → **Store presence** → **Main store listing**:
   - Upload `play_store_icon_512x512.png` (Icon).
   - Upload `feature_graphic_1024x500.jpg` (Feature Graphic).
   - Upload `screenshot_1_dashboard.jpg`, `screenshot_2_domains.jpg`, `screenshot_3_servers.jpg`, `screenshot_4_apps.jpg` (Phone screenshots).
   - Paste the App Name, Short Description, and Full Description.
4. Navigate to **Release** → **Production** (or **Closed testing**):
   - Click **Create new release**.
   - Upload your `.aab` file.
   - **Release name**: `1.0.0 (1)`
   - **Release notes** (copy and paste into the release notes box):
```text
<en-US>
Initial official release of DomainPulse!
• Multi-cloud infrastructure & server monitoring
• Real-time domain registration & expiration alerts
• SSL/TLS certificate validity & renewal tracking
• Google Play Console integration for live mobile app telemetry
• Encrypted credential management & instant incident push notifications
</en-US>
```
   - Click **Next** → **Save and Review**.
5. Once all checklists in **Dashboard** show green checkmarks, submit for Google Review!
