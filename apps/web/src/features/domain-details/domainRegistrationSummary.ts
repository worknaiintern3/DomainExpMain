import type { Domain, DomainRdapMetadata } from '@/api/types';

/**
 * Resolves registration-summary values for Domain Details: prefer the value
 * stored directly on the domains-table record, and only fall back to the
 * latest RDAP lookup (already fetched via getDomainMetadata) when the direct
 * value is null. Never overrides an existing direct value with RDAP data.
 */
export function resolveDomainExpiresAt(
  domain: Pick<Domain, 'expiresAt'> | null,
  rdap: DomainRdapMetadata | null,
): string | null {
  return domain?.expiresAt ?? rdap?.expiresAt ?? null;
}

export function resolveDomainRegisteredAt(
  domain: Pick<Domain, 'registeredAt'> | null,
  rdap: DomainRdapMetadata | null,
): string | null {
  return domain?.registeredAt ?? rdap?.registeredAt ?? null;
}

export function resolveDomainRegistrarLabel(
  domain: Pick<Domain, 'registrarProviderAccountId'>,
  providerLabel: string | undefined,
  rdap: DomainRdapMetadata | null,
): string {
  if (domain.registrarProviderAccountId) {
    return providerLabel ?? 'Resolving provider…';
  }
  return rdap?.registrarName ?? 'Unknown';
}
