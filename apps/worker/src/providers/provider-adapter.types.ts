export const PROVIDER_ERROR_CODES = [
  'AUTH_INVALID',
  'PERMISSION_DENIED',
  'RATE_LIMITED',
  'NETWORK_TIMEOUT',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_BAD_RESPONSE',
  'INVALID_REQUEST',
  'RESOURCE_NOT_FOUND',
  'UNKNOWN_PROVIDER_ERROR',
] as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

export interface SafeProviderError {
  readonly code: ProviderErrorCode;
  readonly retryAfterSeconds: number | null;
}

/**
 * Explicit, honest capability flags for a provider adapter. Only a capability
 * the provider's official API genuinely supports may be `true` -- a `false`
 * or omitted flag must never be worked around by inference, scraping, or
 * fabricated data. Phase 10G registrar adapters populate this from verified
 * API documentation; Cloudflare (Phase 10D) predates this field and is
 * unaffected since it is optional.
 */
export interface ProviderCapabilities {
  readonly listDomains: boolean;
  readonly manageAutoRenew: boolean;
  readonly manageDnsRecords: boolean;
  readonly readAutoRenew: boolean;
  readonly readDnsRecords: boolean;
  readonly readDomainDetails: boolean;
  readonly readNameservers: boolean;
}

export interface ProviderAdapter {
  readonly capabilities?: ProviderCapabilities;
  readonly providerKey: string;
}

export interface ValidProviderToken {
  readonly expiresAt: string | null;
  readonly notBefore: string | null;
  readonly providerTokenId: string;
  readonly status: 'ACTIVE';
  readonly valid: true;
}

export interface InvalidProviderToken {
  readonly errorCode: 'AUTH_INVALID';
  readonly status: 'DISABLED' | 'EXPIRED' | 'INVALID';
  readonly valid: false;
}

export type ProviderTokenValidation =
  | InvalidProviderToken
  | ValidProviderToken;

export interface ProviderTokenValidationCapability {
  validateToken(token: string): Promise<ProviderTokenValidation>;
}

export interface DiscoveredProviderDomain {
  readonly canonicalDomain: string;
  /**
   * Tri-state, not a plain boolean: `true` = confirmed the provider hosts
   * this domain's DNS; `false` = confirmed it does not; `null` = the
   * adapter did not retrieve the evidence needed to know (e.g. Hostinger's
   * bulk portfolio list has no nameserver field). The reconciler must only
   * ever *create* a DNS-provider association on `true`; `false` and `null`
   * both leave any existing association untouched -- `null` must never be
   * treated as a confirmed `false`.
   */
  readonly dnsHostedByProvider: boolean | null;
  readonly externalResourceId: string;
  readonly providerStatus: string;
}

export interface ProviderDomainDiscovery {
  readonly completion: 'COMPLETE' | 'PARTIAL';
  readonly domains: readonly DiscoveredProviderDomain[];
  readonly error: SafeProviderError | null;
  readonly externalResourceType: string;
}

export interface DomainDiscoveryCapability {
  discoverDomains(token: string): Promise<ProviderDomainDiscovery>;
}
