import { Controller, Get, Header } from '@nestjs/common';

const PRIVACY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - DomainPulse</title>
  <meta name="description" content="Privacy Policy for DomainPulse mobile application and services, detailing data collection, Google API compliance, data security, and deletion policies.">
  <style>
    :root {
      --bg: #0b1120;
      --card-bg: #111c33;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --accent: #0284c7;
      --accent-glow: rgba(2, 132, 199, 0.15);
      --border: #1e293b;
      --success: #10b981;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.65;
      padding: 40px 20px;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 48px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .badge {
      display: inline-block;
      background: var(--accent-glow);
      color: #38bdf8;
      font-size: 13px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 9999px;
      border: 1px solid rgba(56, 189, 248, 0.3);
      margin-bottom: 12px;
    }
    h1 {
      font-size: 32px;
      color: #ffffff;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }
    .meta {
      color: var(--text-muted);
      font-size: 14px;
    }
    h2 {
      font-size: 20px;
      color: #f1f5f9;
      font-weight: 700;
      margin-top: 36px;
      margin-bottom: 14px;
      border-left: 4px solid var(--accent);
      padding-left: 12px;
    }
    h3 {
      font-size: 16px;
      color: #e2e8f0;
      font-weight: 600;
      margin-top: 20px;
      margin-bottom: 8px;
    }
    p, ul {
      margin-bottom: 16px;
      color: var(--text);
      font-size: 15px;
    }
    ul {
      padding-left: 24px;
    }
    li {
      margin-bottom: 8px;
    }
    strong {
      color: #ffffff;
    }
    code {
      background: #1e293b;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 14px;
      color: #38bdf8;
    }
    a {
      color: #38bdf8;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .callout {
      background: rgba(2, 132, 199, 0.08);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 12px;
      padding: 18px;
      margin: 20px 0;
    }
    .callout-title {
      font-weight: 700;
      color: #38bdf8;
      margin-bottom: 6px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .footer {
      border-top: 1px solid var(--border);
      margin-top: 48px;
      padding-top: 24px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }
    @media (max-width: 640px) {
      .container {
        padding: 24px 20px;
      }
      h1 {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">Official Legal Document</div>
      <h1>Privacy Policy for DomainPulse</h1>
      <div class="meta">
        <strong>Effective Date:</strong> October 7, 2026 &nbsp;|&nbsp; 
        <strong>Application:</strong> DomainPulse &nbsp;|&nbsp; 
        <strong>Package:</strong> <code>com.domainpulse.mobile</code>
      </div>
    </div>

    <h2>1. Introduction</h2>
    <p>
      Welcome to <strong>DomainPulse</strong> ("we," "our," or "us"). DomainPulse is a multi-cloud infrastructure, domain monitoring, and application telemetry platform developed to help developers, IT administrators, and digital teams monitor domain names, SSL certificates, cloud servers, and mobile applications from a single unified interface.
    </p>
    <p>
      This Privacy Policy explains how we collect, use, disclose, protect, and handle your information when you use our mobile application (<strong>DomainPulse</strong>, package name <code>com.domainpulse.mobile</code>) and related backend services hosted at <code>https://app.domainexprt.com</code> (collectively, the "Service").
    </p>
    <p>
      By accessing or using DomainPulse, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with any part of this policy, please do not use the Service.
    </p>

    <h2>2. Information We Collect</h2>
    <p>We collect information strictly necessary to provide, optimize, and secure our monitoring services:</p>
    <ul>
      <li><strong>Account Credentials:</strong> Email address, display name, and securely hashed passwords.</li>
      <li><strong>Infrastructure Portfolio Data:</strong> Monitored domain names, subdomains, SSL/TLS certificate hostnames, server hostnames, IP addresses, operating systems, and monitoring tags you configure.</li>
      <li><strong>Provider Integration Credentials:</strong> Optional API tokens, secrets, or keys (e.g., Hostinger, Cloudflare, AWS, DigitalOcean, Hetzner, Vultr, Linode, GoDaddy) provided by you to enable automated asset discovery and status polling.</li>
      <li><strong>Device & Diagnostic Telemetry:</strong> Device model, operating system version, app version, network latency, and diagnostic crash logs necessary for service reliability.</li>
    </ul>

    <h2>3. Google Play Console & Google OAuth Data</h2>
    <p>
      When you optionally connect your Google Play Console account via Google OAuth:
    </p>
    <ul>
      <li>We receive your authorized Google Account email, Developer Account ID, and verified application package names with release track statuses (e.g., Production, In Review, Draft).</li>
      <li>We do <strong>not</strong> receive, store, or have access to your Google Account password. All authentication occurs through Google's secure OAuth 2.0 flow.</li>
    </ul>

    <div class="callout">
      <div class="callout-title">Google API Services User Data Policy Compliance</div>
      <p style="margin-bottom: 0;">
        DomainPulse's use and transfer to any other app of information received from Google APIs adheres to the 
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener">Google API Services User Data Policy</a>, 
        including the <strong>Limited Use</strong> requirements. We never sell Google user data, never use it for advertising or marketing, and never use it to train artificial intelligence or machine learning models.
      </p>
    </div>

    <h2>4. How We Use Your Information</h2>
    <p>We use your information exclusively for legitimate operational and monitoring purposes:</p>
    <ul>
      <li>Monitoring domain expiration dates, SSL certificate renewal windows, and cloud server uptime.</li>
      <li>Sending automated push notifications and email alerts before domains expire or when servers encounter downtime.</li>
      <li>Authenticating user sessions and enforcing strict multi-tenant customer data isolation.</li>
      <li>Displaying authorized mobile application status and track releases in your dashboard.</li>
      <li>Defending against abuse, unauthorized access, and malicious requests.</li>
    </ul>

    <h2>5. Data Security and Encryption</h2>
    <p>We implement rigorous security controls to ensure your confidential credentials and telemetry remain protected:</p>
    <ul>
      <li><strong>Encryption in Transit:</strong> All data transmitted between the mobile application, our backend servers (<code>https://app.domainexprt.com</code>), and external APIs is strictly encrypted using <strong>TLS 1.3 / HTTPS</strong>.</li>
      <li><strong>Encryption at Rest:</strong> Cloud provider API tokens, Google OAuth refresh tokens, and secrets are encrypted using <strong>AES-256-GCM</strong> encryption before storage.</li>
      <li><strong>Tenant Isolation:</strong> Database records are strictly bound to authenticated workspace IDs; customer data is fully isolated and inaccessible to other users.</li>
      <li><strong>Password Security:</strong> Passwords are hashed using salted cryptographic algorithms and never stored in plaintext.</li>
    </ul>

    <h2>6. Data Retention & Account Deletion Policy</h2>
    <p>
      We retain your account data only as long as your account remains active. In full compliance with Google Play Store policies, we provide transparent and straightforward account and data deletion mechanisms:
    </p>
    <ul>
      <li><strong>In-App Deletion:</strong> You can delete your account and all associated telemetry directly inside the mobile app via <strong>Settings &rarr; Account &rarr; Delete Account</strong>.</li>
      <li><strong>Web / Email Deletion Request:</strong> You can request permanent account deletion at any time by emailing 
        <a href="mailto:support@domainpulse.io">support@domainpulse.io</a> or 
        <a href="mailto:admin@domainexp.info">admin@domainexp.info</a> with the subject <em>"Account Deletion Request"</em>.
      </li>
      <li><strong>Deletion Timeline:</strong> Upon receiving and verifying your request, your account credentials, cloud tokens, monitored domains, servers, and app telemetry are permanently purged from our primary database within <strong>30 days</strong>.</li>
    </ul>

    <h2>7. Children's Privacy</h2>
    <p>
      DomainPulse is an enterprise infrastructure monitoring tool intended for professionals and developers. It is not directed to children under 13 years of age. We do not knowingly collect personal information from children.
    </p>

    <h2>8. Your Rights (GDPR & CCPA)</h2>
    <p>
      Depending on your jurisdiction, you have the right to access, rectify, export, or erase your personal information, or to disconnect third-party cloud provider connections at any time directly through the app interface.
    </p>

    <h2>9. Contact Information</h2>
    <p>If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please contact our team:</p>
    <ul>
      <li><strong>Primary Email:</strong> <a href="mailto:support@domainpulse.io">support@domainpulse.io</a></li>
      <li><strong>Alternate Email:</strong> <a href="mailto:admin@domainexp.info">admin@domainexp.info</a></li>
      <li><strong>Service Host:</strong> <code>https://app.domainexprt.com</code></li>
      <li><strong>Application:</strong> DomainPulse (<code>com.domainpulse.mobile</code>)</li>
    </ul>

    <div class="footer">
      &copy; 2026 DomainPulse. All rights reserved. &bull; <a href="https://app.domainexprt.com/health">System Status</a>
    </div>
  </div>
</body>
</html>`;

@Controller()
export class PrivacyController {
  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getPrivacy(): string {
    return PRIVACY_HTML;
  }

  @Get('privacy-policy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getPrivacyPolicy(): string {
    return PRIVACY_HTML;
  }
}
