import { describe, expect, it } from 'vitest';

import type { Domain, DomainRdapMetadata } from '@/api/types';
import {
  resolveDomainExpiresAt,
  resolveDomainRegisteredAt,
  resolveDomainRegistrarLabel,
} from './domainRegistrationSummary';

const rdap: DomainRdapMetadata = {
  abuseEmails: [],
  abusePhones: [],
  changedAt: null,
  events: [],
  expiresAt: '2027-08-13T04:00:00.000Z',
  lastAttemptStatus: 'SUCCESS',
  lastAttemptedAt: '2026-01-01T00:00:00.000Z',
  lastErrorCode: null,
  nameservers: [],
  provenance: 'RDAP_RETRIEVED',
  registeredAt: '1995-08-14T04:00:00.000Z',
  registrarIanaId: null,
  registrarName: 'RESERVED-Internet Assigned Numbers Authority',
  registryDomainId: null,
  retrievedAt: '2026-01-01T00:00:00.000Z',
  secureDnsDelegationSigned: null,
  sourceUrl: null,
  statuses: [],
};

const domainWithoutDirectValues: Pick<
  Domain,
  'expiresAt' | 'registeredAt' | 'registrarProviderAccountId'
> = {
  expiresAt: null,
  registeredAt: null,
  registrarProviderAccountId: null,
};

describe('resolveDomainExpiresAt / resolveDomainRegisteredAt', () => {
  it('falls back to the latest RDAP value when the direct domains-table field is null (example.com repro)', () => {
    expect(resolveDomainExpiresAt(domainWithoutDirectValues, rdap)).toBe(
      '2027-08-13T04:00:00.000Z',
    );
    expect(resolveDomainRegisteredAt(domainWithoutDirectValues, rdap)).toBe(
      '1995-08-14T04:00:00.000Z',
    );
  });

  it('prefers the directly stored value over RDAP when both are present', () => {
    const domain = { ...domainWithoutDirectValues, expiresAt: '2030-01-01T00:00:00.000Z', registeredAt: '2000-01-01T00:00:00.000Z' };
    expect(resolveDomainExpiresAt(domain, rdap)).toBe('2030-01-01T00:00:00.000Z');
    expect(resolveDomainRegisteredAt(domain, rdap)).toBe('2000-01-01T00:00:00.000Z');
  });

  it('stays null when neither the direct value nor RDAP metadata exists', () => {
    expect(resolveDomainExpiresAt(domainWithoutDirectValues, null)).toBeNull();
    expect(resolveDomainRegisteredAt(domainWithoutDirectValues, null)).toBeNull();
    expect(resolveDomainExpiresAt(null, null)).toBeNull();
  });
});

describe('resolveDomainRegistrarLabel', () => {
  it('uses the mapped provider account label when the domain has one', () => {
    const domain = { registrarProviderAccountId: 'provider-1' };
    expect(resolveDomainRegistrarLabel(domain, 'GoDaddy', rdap)).toBe('GoDaddy');
  });

  it('shows a resolving placeholder when the provider account is mapped but the label has not loaded yet', () => {
    const domain = { registrarProviderAccountId: 'provider-1' };
    expect(resolveDomainRegistrarLabel(domain, undefined, rdap)).toBe('Resolving provider…');
  });

  it('falls back to the RDAP registrar name when no provider account is mapped (example.com repro)', () => {
    const domain = { registrarProviderAccountId: null };
    expect(resolveDomainRegistrarLabel(domain, undefined, rdap)).toBe(
      'RESERVED-Internet Assigned Numbers Authority',
    );
  });

  it('shows Unknown when there is no provider mapping and no RDAP metadata', () => {
    const domain = { registrarProviderAccountId: null };
    expect(resolveDomainRegistrarLabel(domain, undefined, null)).toBe('Unknown');
  });
});
