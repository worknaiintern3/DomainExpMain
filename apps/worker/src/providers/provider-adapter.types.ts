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

export interface ProviderAdapter {
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
  readonly dnsHostedByProvider: boolean;
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
