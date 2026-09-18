import { createHash } from 'node:crypto';

import type { AlertDnsSnapshot, AlertTlsSnapshot } from './alert.types';

const DAY_MS = 86_400_000;

export function daysUntil(expiry: Date, now: Date): number {
  return Math.floor((expiry.getTime() - now.getTime()) / DAY_MS);
}

function sha256Hex(canonical: string): string {
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function normalizedList(values: readonly string[]): string[] {
  return [
    ...new Set(
      values
        .map((value) => value.trim().toLowerCase().replace(/\.$/u, ''))
        .filter((value) => value.length > 0),
    ),
  ].sort();
}

function mxCanonical(
  records: readonly { exchange: string; priority: number }[],
): string[] {
  return [
    ...new Set(
      records.map(
        (record) =>
          `${String(record.priority)}:${record.exchange.trim().toLowerCase().replace(/\.$/u, '')}`,
      ),
    ),
  ].sort();
}

function dsCanonical(
  records: readonly {
    algorithm: number;
    digest: string;
    digestType: number;
    keyTag: number;
  }[],
): string[] {
  return [
    ...new Set(
      records.map(
        (record) =>
          `${String(record.keyTag)}:${String(record.algorithm)}:${String(record.digestType)}:${record.digest.trim().toUpperCase()}`,
      ),
    ),
  ].sort();
}

/**
 * Deterministic fingerprint over normalized DNS record data only.
 * Record-level errors and raw TXT contents are excluded so transient
 * partial failures do not flap the fingerprint.
 */
export function dnsFingerprint(snapshot: AlertDnsSnapshot): string {
  const canonical = [
    `a=${normalizedList(snapshot.aRecords).join(',')}`,
    `aaaa=${normalizedList(snapshot.aaaaRecords).join(',')}`,
    `cname=${normalizedList(snapshot.cnameRecords).join(',')}`,
    `mx=${mxCanonical(snapshot.mxRecords).join(',')}`,
    `ns=${normalizedList(snapshot.nsRecords).join(',')}`,
    `ds=${dsCanonical(snapshot.dsRecords).join(',')}`,
    `txt=${String(snapshot.txtRecordCount)}`,
  ].join('|');
  return sha256Hex(canonical);
}

/**
 * Deterministic fingerprint over persisted certificate identity fields.
 * No PEM body or raw certificate material is used.
 */
export function tlsFingerprint(snapshot: AlertTlsSnapshot): string {
  const text = (value: string | null): string => value?.trim() ?? '';
  const sans = [...new Set(snapshot.subjectAltNames.map((name) => name.trim().toLowerCase()).filter((name) => name.length > 0))].sort();
  const canonical = [
    `fp=${text(snapshot.fingerprint256).toUpperCase()}`,
    `serial=${text(snapshot.serialNumber).toUpperCase()}`,
    `issuerCN=${text(snapshot.issuerCommonName)}`,
    `issuerO=${text(snapshot.issuerOrganization)}`,
    `subjectCN=${text(snapshot.subjectCommonName)}`,
    `sans=${sans.join(',')}`,
    `from=${snapshot.validFrom?.toISOString() ?? ''}`,
    `to=${snapshot.validTo?.toISOString() ?? ''}`,
  ].join('|');
  return sha256Hex(canonical);
}

export function shortFingerprint(fingerprint: string): string {
  return fingerprint.slice(0, 12);
}
