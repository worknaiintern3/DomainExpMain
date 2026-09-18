export const NAMECHEAP_PROVIDER_KEY = 'namecheap';
export const NAMECHEAP_DOMAIN_RESOURCE_TYPE = 'namecheap.domain';

/**
 * Namecheap has no OTE/sandbox equivalent to Cloudflare/GoDaddy that this
 * adapter targets: production only, matching the fixed-official-base-URL
 * rule (no user-controlled base URL / SSRF). Namecheap's sandbox
 * (api.sandbox.namecheap.com) uses entirely separate credentials/account
 * data and is a documented, deliberate Phase 10G limitation, not something
 * this adapter can safely offer as a runtime toggle.
 */
export const NAMECHEAP_API_ORIGIN = 'https://api.namecheap.com';
export const NAMECHEAP_API_PATH = '/xml.response';
export const NAMECHEAP_GET_LIST_COMMAND = 'namecheap.domains.getList';

export const NAMECHEAP_DEFAULT_TIMEOUT_MS = 10_000;
export const NAMECHEAP_DEFAULT_PAGE_SIZE = 100;
export const NAMECHEAP_MAX_PAGE_SIZE = 100;
export const NAMECHEAP_MIN_PAGE_SIZE = 10;
export const NAMECHEAP_DEFAULT_MAX_PAGES = 1_000;
export const NAMECHEAP_MAX_RESPONSE_BYTES = 2_000_000;
export const NAMECHEAP_MAX_CREDENTIAL_LENGTH = 4_096;
export const NAMECHEAP_MAX_RETRY_AFTER_SECONDS = 86_400;

const IPV4_PATTERN = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/u;

export interface NamecheapCredential {
  readonly apiKey: string;
  readonly apiUser: string;
  readonly clientIp: string;
  readonly userName: string;
}

/**
 * Namecheap requires four distinct values per call (ApiUser, ApiKey,
 * UserName, ClientIp -- the last must be one of up to 10 IPv4 addresses
 * whitelisted in the Namecheap account dashboard). DomainPulse's connection
 * credential column stores one opaque string, so all four are carried as a
 * single JSON-encoded value; this function validates and parses it entirely
 * locally, before any network call.
 */
export function parseNamecheapCredential(raw: string): NamecheapCredential {
  if (
    typeof raw !== 'string' ||
    raw.trim().length === 0 ||
    raw.length > NAMECHEAP_MAX_CREDENTIAL_LENGTH
  ) {
    throw new InvalidNamecheapCredentialError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidNamecheapCredentialError();
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new InvalidNamecheapCredentialError();
  }
  const { apiKey, apiUser, clientIp, userName } = parsed as Record<string, unknown>;
  for (const value of [apiKey, apiUser, clientIp, userName]) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new InvalidNamecheapCredentialError();
    }
  }
  if (typeof clientIp !== 'string' || !IPV4_PATTERN.test(clientIp)) {
    throw new InvalidNamecheapCredentialError();
  }
  return {
    apiKey: apiKey as string,
    apiUser: apiUser as string,
    clientIp,
    userName: userName as string,
  };
}

export class InvalidNamecheapCredentialError extends Error {
  constructor() {
    super('Namecheap credential must be JSON with apiUser, apiKey, userName, and a whitelisted IPv4 clientIp');
    this.name = 'InvalidNamecheapCredentialError';
  }
}
