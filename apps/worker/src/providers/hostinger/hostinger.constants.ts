export const HOSTINGER_PROVIDER_KEY = 'hostinger';
export const HOSTINGER_DOMAIN_RESOURCE_TYPE = 'hostinger.domain';
export const HOSTINGER_VPS_RESOURCE_TYPE = 'hostinger.vps';

/** Hostinger documents no sandbox/test environment: requests always act on the real account. */
export const HOSTINGER_API_ORIGIN = 'https://developers.hostinger.com';
export const HOSTINGER_DOMAINS_PORTFOLIO_PATH = '/api/domains/v1/portfolio';
export const HOSTINGER_VPS_PATH = '/api/vps/v1/virtual-machines';

export const HOSTINGER_DEFAULT_TIMEOUT_MS = 8_000;
/** The portfolio list endpoint returns every domain in one unpaginated array (no page/limit params documented). */
export const HOSTINGER_MAX_RESPONSE_BYTES = 4_000_000;
export const HOSTINGER_MAX_TOKEN_LENGTH = 4_096;
export const HOSTINGER_MAX_RETRY_AFTER_SECONDS = 86_400;
/** Documented account-wide limit: 90 requests/minute. */
export const HOSTINGER_RATE_LIMIT_PER_MINUTE = 90;
