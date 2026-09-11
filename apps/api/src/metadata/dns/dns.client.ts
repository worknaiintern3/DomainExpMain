import * as dnsPromises from 'node:dns/promises';

import type { DomainDnsDsRecord, DomainDnsMxRecord, DomainDnsRecordErrors } from '@domainpulse/database';

export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'NS' | 'DS' | 'TXT';
export type DnsRecordErrorCode = 'DNS_TIMEOUT' | 'DNS_RESOLVER_ERROR' | 'DNS_RESPONSE_INVALID';

export interface DnsResolver {
  resolve4(domain: string): Promise<readonly string[]>;
  resolve6(domain: string): Promise<readonly string[]>;
  resolveCname(domain: string): Promise<readonly string[]>;
  resolveMx(domain: string): Promise<readonly { readonly exchange: string; readonly priority: number }[]>;
  resolveNs(domain: string): Promise<readonly string[]>;
  resolveDs(domain: string): Promise<unknown>;
  resolveTxt(domain: string): Promise<readonly (readonly string[])[]>;
}

export interface DnsSnapshot {
  readonly aRecords: readonly string[];
  readonly aaaaRecords: readonly string[];
  readonly cnameRecords: readonly string[];
  readonly dsRecords: readonly DomainDnsDsRecord[];
  readonly mxRecords: readonly DomainDnsMxRecord[];
  readonly nsRecords: readonly string[];
  readonly recordErrors: DomainDnsRecordErrors;
  readonly txtRecordCount: number;
}

export interface DnsRetrieval {
  readonly errorCode: 'DNS_PARTIAL_FAILURE' | 'DNS_RETRIEVAL_FAILED' | null;
  readonly snapshot: DnsSnapshot;
  readonly status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
}

const systemResolver: DnsResolver = {
  resolve4: async (domain) => await dnsPromises.resolve4(domain),
  resolve6: async (domain) => await dnsPromises.resolve6(domain),
  resolveCname: async (domain) => await dnsPromises.resolveCname(domain),
  resolveMx: async (domain) => await dnsPromises.resolveMx(domain),
  resolveNs: async (domain) => await dnsPromises.resolveNs(domain),
  resolveDs: async (domain) => await dnsPromises.resolve(domain, 'DS'),
  resolveTxt: async (domain) => await dnsPromises.resolveTxt(domain),
};

const NO_DATA_CODES = new Set(['ENODATA', 'ENOTFOUND', 'ENONAME', 'NOTFOUND', 'NODATA']);

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code.toUpperCase()
    : undefined;
}

function normalizedStrings(values: readonly string[], hostname = false): string[] {
  return [...new Set(values.map((value) => {
    const normalized = value.trim().toLowerCase();
    return hostname ? normalized.replace(/\.$/u, '') : normalized;
  }).filter(Boolean))].sort();
}

function normalizeMx(values: readonly { readonly exchange: string; readonly priority: number }[]): DomainDnsMxRecord[] {
  const records = values.flatMap(({ exchange, priority }) => {
    const normalizedExchange = exchange.trim().toLowerCase().replace(/\.$/u, '');
    return normalizedExchange && Number.isInteger(priority) && priority >= 0
      ? [{ exchange: normalizedExchange, priority }]
      : [];
  });
  const unique = new Map(records.map((record) => [`${String(record.priority)}:${record.exchange}`, record]));
  return [...unique.values()].sort((left, right) => left.priority - right.priority || left.exchange.localeCompare(right.exchange));
}

function normalizeDs(value: unknown): DomainDnsDsRecord[] {
  if (!Array.isArray(value)) throw Object.assign(new Error('Invalid DS response'), { code: 'DNS_RESPONSE_INVALID' });
  const records = value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const shape = item as Record<string, unknown>;
    const algorithm = shape.algorithm;
    const digest = shape.digest;
    const digestType = shape.digestType;
    const keyTag = shape.keyTag;
    return Number.isInteger(algorithm) && typeof digest === 'string' && digest.trim() !== ''
      && Number.isInteger(digestType) && Number.isInteger(keyTag)
      ? [{
        algorithm: algorithm as number,
        digest: digest.trim().toUpperCase(),
        digestType: digestType as number,
        keyTag: keyTag as number,
      }]
      : [];
  });
  const unique = new Map(records.map((record) => [
    `${String(record.keyTag)}:${String(record.algorithm)}:${String(record.digestType)}:${record.digest}`,
    record,
  ]));
  return [...unique.values()].sort((left, right) =>
    left.keyTag - right.keyTag
    || left.algorithm - right.algorithm
    || left.digestType - right.digestType
    || left.digest.localeCompare(right.digest));
}

interface SettledRecord<T> {
  readonly error?: DnsRecordErrorCode;
  readonly noData?: boolean;
  readonly value: T;
}

async function settle<T>(operation: () => Promise<T>, empty: T): Promise<SettledRecord<T>> {
  try {
    return { value: await operation() };
  } catch (error) {
    const code = errorCode(error);
    if (code && NO_DATA_CODES.has(code)) return { noData: true, value: empty };
    return {
      error: code === 'ETIMEOUT' || code === 'ETIMEDOUT'
        ? 'DNS_TIMEOUT'
        : code === 'DNS_RESPONSE_INVALID' ? 'DNS_RESPONSE_INVALID' : 'DNS_RESOLVER_ERROR',
      value: empty,
    };
  }
}

export class DnsClient {
  constructor(private readonly resolver: DnsResolver = systemResolver) {}

  async retrieve(domain: string): Promise<DnsRetrieval> {
    const [a, aaaa, cname, mx, ns, ds, txt] = await Promise.all([
      settle(() => this.resolver.resolve4(domain), [] as readonly string[]),
      settle(() => this.resolver.resolve6(domain), [] as readonly string[]),
      settle(() => this.resolver.resolveCname(domain), [] as readonly string[]),
      settle(() => this.resolver.resolveMx(domain), [] as readonly { readonly exchange: string; readonly priority: number }[]),
      settle(() => this.resolver.resolveNs(domain), [] as readonly string[]),
      settle(async () => normalizeDs(await this.resolver.resolveDs(domain)), [] as DomainDnsDsRecord[]),
      settle(() => this.resolver.resolveTxt(domain), [] as readonly (readonly string[])[]),
    ]);
    const records: readonly (readonly [DnsRecordType, SettledRecord<unknown>])[] = [
      ['A', a], ['AAAA', aaaa], ['CNAME', cname], ['MX', mx], ['NS', ns], ['DS', ds], ['TXT', txt],
    ];
    const recordErrors = Object.fromEntries(
      records.flatMap(([type, result]) => result.error ? [[type, result.error]] : []),
    );
    const failureCount = Object.keys(recordErrors).length;
    const completedCount = records.filter(([, result]) => !result.error).length;
    const status = failureCount === 0 ? 'SUCCESS' : completedCount > 0 ? 'PARTIAL' : 'FAILED';
    return {
      errorCode: status === 'PARTIAL' ? 'DNS_PARTIAL_FAILURE' : status === 'FAILED' ? 'DNS_RETRIEVAL_FAILED' : null,
      snapshot: {
        aRecords: normalizedStrings(a.value),
        aaaaRecords: normalizedStrings(aaaa.value),
        cnameRecords: normalizedStrings(cname.value, true),
        dsRecords: ds.value,
        mxRecords: normalizeMx(mx.value),
        nsRecords: normalizedStrings(ns.value, true),
        recordErrors,
        txtRecordCount: txt.value.length,
      },
      status,
    };
  }
}
