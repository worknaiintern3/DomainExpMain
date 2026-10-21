import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildBackup,
  describeImportResult,
  domainsToCsv,
  normalizeDomainName,
  parseBackupJson,
  parseDomainsCsv,
} from '@/features/settings/data-transfer';
import type { Domain } from '@/api/types';

const { createInventory, listInventory } = vi.hoisted(() => ({
  createInventory: vi.fn(),
  listInventory: vi.fn(),
}));

vi.mock('@/api/inventory', async () => {
  const actual = await vi.importActual<typeof import('@/api/inventory')>('@/api/inventory');
  return { ...actual, createInventory, listInventory };
});

vi.mock('@/api/monitoring', async () => {
  const actual = await vi.importActual<typeof import('@/api/monitoring')>('@/api/monitoring');
  return { ...actual, getAlertsSummary: vi.fn(async () => ({ open: 0 })) };
});

function domain(name: string): Domain {
  return {
    autoRenew: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    dnsProviderAccountId: null,
    domainName: name,
    expiresAt: '2027-01-01T00:00:00.000Z',
    id: `id-${name}`,
    inventoryState: 'TRACKED',
    notes: null,
    provenance: 'USER_ADDED',
    registeredAt: '2025-01-01T00:00:00.000Z',
    registrarProviderAccountId: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('data-transfer parsing', () => {
  it('normalizes and rejects domain names', () => {
    expect(normalizeDomainName('  Example.COM ')).toBe('example.com');
    expect(normalizeDomainName('not a domain')).toBeNull();
    expect(normalizeDomainName('localhost')).toBeNull();
  });

  it('parses a CSV with a domain_name header and skips invalid rows', () => {
    const parsed = parseDomainsCsv('domain_name,registrar\nexample.com,GoDaddy\nbad name,x\nexample.in,y\n');
    expect(parsed.names).toEqual(['example.com', 'example.in']);
    expect(parsed.invalid).toEqual(['bad name']);
  });

  it('parses a headerless CSV as bare names and dedupes', () => {
    const parsed = parseDomainsCsv('example.com\nEXAMPLE.com\n');
    expect(parsed.names).toEqual(['example.com']);
  });

  it('round-trips domains through CSV', () => {
    const csv = domainsToCsv([domain('example.com')]);
    expect(csv.split('\n')[0]).toContain('domain_name');
    expect(parseDomainsCsv(csv).names).toEqual(['example.com']);
  });

  it('parses our own backup dumps and rejects foreign JSON', () => {
    const dump = buildBackup(
      {
        applications: 0,
        cloudResources: 0,
        domains: 1,
        emailAccounts: 0,
        projects: 0,
        providerAccounts: 0,
        servers: 0,
      },
      [domain('example.com')],
    );
    const parsed = parseBackupJson(dump);
    expect(parsed.domains).toHaveLength(1);
    expect(parsed.domains[0]?.domainName).toBe('example.com');

    expect(() => parseBackupJson('{"domains":[]}')).toThrow(/not a DomainPulse backup/iu);
    expect(() => parseBackupJson('nope')).toThrow();
  });

  it('describes import results truthfully', () => {
    const ok = describeImportResult({ created: 2, failed: [], skipped: 1 }, 'csv');
    expect(ok.type).toBe('success');
    expect(ok.message).toContain('2');
    expect(ok.description).toContain('1 already existed');

    const none = describeImportResult(
      { created: 0, failed: [{ name: 'x', reason: 'bad' }], skipped: 0 },
      'json',
    );
    expect(none.type).toBe('error');
  });
});

describe('data-transfer import', () => {
  it('skips names already in the workspace and creates the rest', async () => {
    const { importDomainNames } = await import('@/features/settings/data-transfer');
    vi.mocked(listInventory).mockResolvedValue({ items: [domain('example.com')], nextCursor: null });
    vi.mocked(createInventory).mockImplementation(async (_resource, input) => domain(String((input as Record<string, unknown>).domainName)));

    const result = await importDomainNames(['example.com', 'new.test']);
    expect(result).toEqual({ created: 1, failed: [], skipped: 1 });
    expect(createInventory).toHaveBeenCalledTimes(1);
    expect(createInventory).toHaveBeenCalledWith('domains', { domainName: 'new.test' });
  });

  it('collects per-row failures instead of aborting', async () => {
    const { importDomainNames } = await import('@/features/settings/data-transfer');
    vi.mocked(listInventory).mockResolvedValue({ items: [], nextCursor: null });
    vi.mocked(createInventory)
      .mockRejectedValueOnce(new Error('duplicate'))
      .mockImplementation(async (_resource, input) => domain(String((input as Record<string, unknown>).domainName)));

    const result = await importDomainNames(['a.test', 'b.test']);
    expect(result.created).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.name).toBe('a.test');
  });
});
