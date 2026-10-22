# Privacy Policy for DomainPulse

**Effective Date:** October 7, 2026  
**Last Updated:** October 7, 2026  
**Application Name:** DomainPulse  
**Android Package Name:** `com.domainpulse.mobile`  
**Developer / Service Provider:** DomainPulse Team  
**Contact Email:** [support@domainpulse.io](mailto:support@domainpulse.io) / [admin@domainexp.info](mailto:admin@domainexp.info)  

---

## 1. Introduction

Welcome to **DomainPulse** ("we," "our," or "us"). DomainPulse is a multi-cloud infrastructure, domain monitoring, and application telemetry platform developed to help developers, IT administrators, and digital teams monitor domain names, SSL certificates, cloud servers, and mobile applications from a single interface.

This Privacy Policy explains how we collect, use, disclose, protect, and handle your information when you use our mobile application (**DomainPulse**, package name `com.domainpulse.mobile`) and related backend services hosted at `https://app.domainexprt.com` (collectively, the "Service").

By accessing or using DomainPulse, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with any part of this policy, please do not use the Service.

---

## 2. Information We Collect

We collect information to provide, maintain, optimize, and secure our monitoring and telemetry services:

### A. Information You Provide Directly
* **Account Information:** When you register or log in, we collect your email address, display name, and securely hashed password.
* **Infrastructure Configuration Data:** Domain names, subdomains, SSL certificate hostnames, server hostnames, primary IP addresses, operating system types, and monitoring tags you add to your portfolio.
* **Provider Integration Credentials:** When you choose to connect cloud providers or domain registrars (such as Hostinger, Cloudflare, AWS, DigitalOcean, Hetzner, Vultr, Linode, or GoDaddy), you may provide API keys, tokens, or credentials to enable live asset discovery and telemetry polling.
* **Support Inquiries:** Information you submit when contacting support, including crash details or bug reports.

### B. Google Play Console & Google Account Information
When you optionally connect your Google Play Console account via Google OAuth:
* **Google Account Email & ID:** The email address and account identifier associated with your authorized Google Account.
* **Developer Account ID:** The Google Play Developer Account ID you configure and verify.
* **Application Metadata:** Authoritative package names, app titles, and release track statuses (e.g., Production, In Review, Unpublished, Draft) retrieved via the official Google Play Developer API.
* *Note:* We do **not** receive, store, or have access to your Google Account password. All authentication occurs through Google's secure OAuth 2.0 protocol.

### C. Automatically Collected Information
* **Device and Telemetry Data:** Device model, operating system version, app version (`1.0.0`), unique device identifier (for push notification tokens), and language preferences.
* **Performance & Diagnostic Logs:** API response latency measurements, HTTP status codes, connection errors, and crash reports required to ensure service uptime and reliability.

---

## 3. How We Use Your Information

We use the collected information solely for legitimate operational and monitoring purposes:

1. **Service Delivery:** To monitor domain expiration dates, verify SSL/TLS certificate validity, ping server endpoints, and calculate infrastructure health scores.
2. **Account Management & Multi-Tenant Isolation:** To authenticate users, manage active sessions, and ensure that Customer A's monitored assets remain strictly isolated and inaccessible to Customer B.
3. **Notifications & Alerts:** To deliver push notifications and automated alerts before domain names expire, SSL certificates lapse, or server latency thresholds are exceeded.
4. **Google Play Integration:** To display authorized mobile app statuses and release tracks within your personal application dashboard.
5. **Security & Abuse Prevention:** To protect against unauthorized access, credential abuse, rate-limit violations, and malicious traffic.

---

## 4. Google API Services User Data Policy Compliance

DomainPulse strictly complies with the **Google API Services User Data Policy**, including the **Limited Use** requirements:

* **Limited Use:** DomainPulse's use and transfer to any other app of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.
* **No Advertising Use:** We **never** use information obtained through Google APIs for serving advertisements, retargeting, or interest-based marketing.
* **No Selling of User Data:** We **never** sell, rent, monetize, or lease Google user data or credentials to data brokers, advertising networks, or third parties.
* **No AI/ML Model Training:** Data obtained from Google APIs is **never** used to train generalized artificial intelligence or machine learning models.
* **Minimal Scope:** We only request the minimum Google OAuth scopes necessary to verify your authorized developer account and discover app release tracks (`androidpublisher`, `openid`, `email`, `profile`).

---

## 5. Data Security and Encryption

We implement industry-standard administrative, physical, and technical security controls to safeguard your data:

* **Encryption in Transit:** All communication between the DomainPulse mobile app, backend servers (`https://app.domainexprt.com`), and external APIs is encrypted using **TLS 1.3 / HTTPS**. Plaintext HTTP connections are rejected.
* **Encryption at Rest:** Sensitive provider API tokens, Google OAuth refresh tokens, and credentials are encrypted at rest using **AES-256-GCM** encryption before being stored in the database.
* **Tenant Isolation:** Database records and mobile caches are keyed to authenticated workspace and user IDs. Users can only query and view resources belonging to their own verified account.
* **Password Hashing:** Passwords are never stored in plaintext and are hashed using modern cryptographic algorithms with unique salt.

---

## 6. Data Sharing and Third-Party Disclosures

We do not sell, trade, or share your personal data with third parties, except in the following limited circumstances:

* **Connected Service Providers:** When you explicitly connect an external provider (such as Hostinger, Cloudflare, or Google Play Console), our servers query that provider's official API strictly on your behalf to fetch your resource inventory.
* **Public DNS and WHOIS Registrars:** To verify domain registration dates and SSL certificates, our automated monitors query authoritative public WHOIS and RDAP registries. No personal user credentials are transmitted during public DNS/WHOIS lookups.
* **Legal Compliance:** We may disclose information only if required by law, subpoena, or valid legal process, or to protect the vital security of our users and infrastructure.

---

## 7. Data Retention and Account Deletion Policy

### Retention
We retain your account information and telemetry data for as long as your account remains active and as necessary to provide you with monitoring services.

### Right to Deletion (Google Play Compliance)
You have the right to request the permanent deletion of your account and all associated data at any time:

1. **In-App Deletion:** Navigate to **Settings** / **More** &rarr; **Account** &rarr; **Delete Account**. Confirming this action will immediately terminate your session and schedule your account data for permanent removal.
2. **Web / Email Request:** You can submit a deletion request at any time by emailing [support@domainpulse.io](mailto:support@domainpulse.io) or [admin@domainexp.info](mailto:admin@domainexp.info) with the subject *"Account Deletion Request"*.
3. **Deletion Timeline:** Upon receiving a verified request, your account details, stored provider tokens, monitored domains, server nodes, and application records will be permanently deleted from our primary databases within **30 days**.

---

## 8. Children's Privacy

DomainPulse is an infrastructure monitoring tool designed strictly for business, professional, and developer use. We do not knowingly collect, solicit, or maintain personal information from children under the age of 13 (or under 16 in the European Economic Area). If we learn that we have inadvertently collected information from a child without parental consent, we will promptly delete that information.

---

## 9. Your Rights (GDPR & CCPA/CPRA)

Depending on your geographic location, you may have specific privacy rights:

* **Access and Portability:** The right to request copies of the personal data we hold about you.
* **Rectification:** The right to update or correct inaccurate or incomplete account information.
* **Erasure:** The right to request the deletion of your personal data.
* **Revocation of Consent:** The right to disconnect third-party integrations (such as Google Play Console or cloud provider API tokens) at any time through the app.

To exercise any of these rights, contact us at [support@domainpulse.io](mailto:support@domainpulse.io).

---

## 10. Changes to This Privacy Policy

We may periodically update this Privacy Policy to reflect enhancements to our features, operational practices, or legal requirements. When updates are published, the "Last Updated" date at the top of this policy will be revised. We encourage you to review this policy periodically. Continued use of DomainPulse after changes are posted constitutes your acceptance of the revised policy.

---

## 11. Contact Us

If you have questions, comments, or concerns regarding this Privacy Policy or our data handling practices, please contact us:

* **Email:** [support@domainpulse.io](mailto:support@domainpulse.io)
* **Alternate Contact:** [admin@domainexp.info](mailto:admin@domainexp.info)
* **Service URL:** `https://app.domainexprt.com`
* **Application:** DomainPulse (`com.domainpulse.mobile`)

---

## 12. Google Play Store Data Safety Questionnaire Guide

When completing the **App Content &rarr; Data safety** section in Google Play Console, use the following authoritative answers based on this policy:

| Data Type | Collected? | Shared? | Purpose | Ephemeral? | Required or Optional? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Personal Info: Name** | Yes | No | App functionality, Account management | No | Optional (Display name) |
| **Personal Info: Email address** | Yes | No | App functionality, Account management | No | Required |
| **Personal Info: User IDs** | Yes | No | App functionality, Account management | No | Required (Internal workspace/user ID) |
| **App info & performance: Crash logs** | Yes | No | Analytics, App functionality | No | Optional |
| **App info & performance: Diagnostics** | Yes | No | Analytics, App functionality (Latency, uptime) | No | Optional |
| **Device or other IDs** | Yes | No | App functionality (Push notification tokens) | No | Optional |
| **Financial info** | No | No | N/A | N/A | N/A |
| **Location** | No | No | N/A | N/A | N/A |
| **Photos & Videos** | No | No | N/A | N/A | N/A |
| **Audio files** | No | No | N/A | N/A | N/A |
| **Contacts** | No | No | N/A | N/A | N/A |

### Security Practices Checklist:
* **Is data encrypted in transit?** Yes (All network calls use HTTPS / TLS 1.3).
* **Do you provide a way for users to request data deletion?** Yes (In-app deletion and email request via support@domainpulse.io / admin@domainexp.info).
* **Target age group:** 18 and older.

