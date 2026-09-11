export const RDAP_ERROR_CODES = [
  'RDAP_INVALID_DOMAIN',
  'RDAP_BOOTSTRAP_TIMEOUT',
  'RDAP_BOOTSTRAP_NETWORK_ERROR',
  'RDAP_BOOTSTRAP_HTTP_ERROR',
  'RDAP_BOOTSTRAP_INVALID',
  'RDAP_TLD_UNSUPPORTED',
  'RDAP_LOOKUP_TIMEOUT',
  'RDAP_LOOKUP_NETWORK_ERROR',
  'RDAP_LOOKUP_NOT_FOUND',
  'RDAP_LOOKUP_HTTP_ERROR',
  'RDAP_RESPONSE_INVALID',
  'RDAP_RESPONSE_TOO_LARGE',
  'RDAP_UNSAFE_URL',
  'RDAP_TOO_MANY_REDIRECTS',
] as const;

export type RdapErrorCode = typeof RDAP_ERROR_CODES[number];

export class RdapRetrievalError extends Error {
  constructor(readonly code: RdapErrorCode) {
    super(code);
    this.name = 'RdapRetrievalError';
  }
}
