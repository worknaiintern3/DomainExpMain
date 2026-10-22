/**
 * Canonical site URL — single source of truth for metadata, sitemap, robots.
 *
 * The production origin is app.domainexprt.com. Override it for other deployments.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://app.domainexprt.com";

/**
 * Origin of the DomainPulse web app that owns /login and /register.
 * Empty (default) = same origin as this landing page, e.g. nginx serves the
 * landing at "/" and the app everywhere else. For a separate host set
 * `NEXT_PUBLIC_APP_URL=https://app.example.com` (no trailing slash).
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

export const LOGIN_URL = `${APP_URL}/login`;
export const REGISTER_URL = `${APP_URL}/register`;
export const FIND_DOMAIN_URL = `${APP_URL}/find-domain`;
