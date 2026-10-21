import {
  createInventory,
  getInventorySummary,
  listInventory,
  type InventorySummary,
} from '@/api/inventory';
import type { Domain, InventoryResource, InventoryResourceMap } from '@/api/types';
import { getAlertsSummary } from '@/api/monitoring';

/**
 * Real inventory import/export for the Data Management tab.
 *
 * There is no server-side bulk import/export/backup endpoint, so transfers
 * run in the browser against the real per-record inventory APIs:
 * - Export reads every page of each resource and downloads a file.
 * - Import parses a user-picked file and creates records one by one.
 * - A JSON snapshot contains domains only; import adds missing domains but
 *   does not overwrite existing records or restore unrelated resources.
 * Nothing here is simulated: counts come from /inventory/summary and every
 * created record is a real POST.
 */

export const BACKUP_VERSION = '1.0';
export const MAX_IMPORT_ROWS = 200;

export interface BackupDump {
  version: string;
  exportedAt: string;
  summary: InventorySummary;
  domains: Domain[];
}

export interface ImportRowResult {
  created: number;
  skipped: number;
  failed: Array<{ name: string; reason: string }>;
}

function isFullDomain(value: string): boolean {
  return /^[^\s.]+(?:\.[^\s.]+)+$/u.test(value);
}

export function normalizeDomainName(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase();
  if (!isFullDomain(cleaned)) return null;
  return cleaned;
}

async function fetchAll<R extends InventoryResource>(resource: R): Promise<Array<InventoryResourceMap[R]>> {
  const items: Array<InventoryResourceMap[R]> = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await listInventory(resource, { cursor, limit: 100 });
    items.push(...page.items);
    if (!page.nextCursor) return items;
    cursor = page.nextCursor;
  }
}

export async function fetchLiveInventory(): Promise<{ summary: InventorySummary; domains: Domain[] }> {
  const [summary, domains] = await Promise.all([
    getInventorySummary(),
    fetchAll('domains'),
  ]);
  return { domains, summary };
}

export async function fetchOpenAlertCount(): Promise<number> {
  const { open } = await getAlertsSummary();
  return open;
}

function csvCell(value: string | null | undefined): string {
  const text = value ?? '';
  return /[",\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

export function domainsToCsv(domains: Domain[]): string {
  const header = 'domain_name,auto_renew,registered_at,expires_at,inventory_state,notes';
  const lines = domains.map((domain) =>
    [
      csvCell(domain.domainName),
      csvCell(domain.autoRenew === null ? '' : String(domain.autoRenew)),
      csvCell(domain.registeredAt),
      csvCell(domain.expiresAt),
      csvCell(domain.inventoryState),
      csvCell(domain.notes),
    ].join(','),
  );
  return [header, ...lines].join('\n');
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export interface ParsedCsv {
  names: string[];
  invalid: string[];
}

/** Accepts `domain_name` (or `domainName`/`domain`) headers; extra columns are ignored. */
export function parseDomainsCsv(text: string): ParsedCsv {
  const names: string[] = [];
  const invalid: string[] = [];
  const lines = text.split(/\r?\n/u).filter((line) => line.trim() !== '');
  if (lines.length === 0) return { invalid, names };
  const header = splitCsvLine(lines[0] ?? '').map((cell) => cell.toLowerCase());
  let nameIndex = header.findIndex((cell) => cell === 'domain_name' || cell === 'domainname' || cell === 'domain');
  let start = 1;
  if (nameIndex === -1) {
    // No header row: treat every line as a bare domain name.
    nameIndex = 0;
    start = 0;
  }
  const seen = new Set<string>();
  for (let i = start; i < lines.length; i += 1) {
    const raw = splitCsvLine(lines[i] ?? '')[nameIndex] ?? '';
    if (raw === '') continue;
    const normalized = normalizeDomainName(raw);
    if (!normalized) {
      invalid.push(raw);
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      names.push(normalized);
    }
  }
  return { invalid, names };
}

function parseAutoRenew(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw !== 'string') return null;
  const text = raw.trim().toLowerCase();
  if (['on', 'true', '1', 'yes'].includes(text)) return true;
  if (['off', 'false', '0', 'no'].includes(text)) return false;
  return null;
}

export interface ParsedBackup {
  domains: Array<{ autoRenew: boolean | null; domainName: string; notes: string | null }>;
  invalid: string[];
}

export function parseBackupJson(text: string): ParsedBackup {
  const invalid: string[] = [];
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('This file is not a DomainPulse backup.');
  }
  const record = parsed as Record<string, unknown>;
  if (record.version !== BACKUP_VERSION || !Array.isArray(record.domains)) {
    throw new Error('This file is not a DomainPulse backup (expected version "1.0" with a domains list).');
  }
  const domains: ParsedBackup['domains'] = [];
  const seen = new Set<string>();
  for (const entry of record.domains) {
    if (typeof entry !== 'object' || entry === null) {
      invalid.push('entry');
      continue;
    }
    const row = entry as Record<string, unknown>;
    const normalized =
      typeof row.domainName === 'string' ? normalizeDomainName(row.domainName) : null;
    if (!normalized) {
      invalid.push(typeof row.domainName === 'string' ? row.domainName : 'entry');
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    domains.push({
      autoRenew: parseAutoRenew(row.autoRenew),
      domainName: normalized,
      notes: typeof row.notes === 'string' ? row.notes : null,
    });
  }
  return { domains, invalid };
}

export function buildBackup(summary: InventorySummary, domains: Domain[]): string {
  const dump: BackupDump = {
    domains,
    exportedAt: new Date().toISOString(),
    summary,
    version: BACKUP_VERSION,
  };
  return JSON.stringify(dump, null, 2);
}

/** Tells live inventory views (e.g. the Data Management counts) to refetch. */
export function refreshInventoryViews(): void {
  window.dispatchEvent(new Event('domainpulse:inventory-changed'));
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Creates one domain per name, skipping names already in the workspace. */
export async function importDomainNames(
  names: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<ImportRowResult> {
  const capped = names.slice(0, MAX_IMPORT_ROWS);
  const existing = new Set((await fetchAll('domains')).map((domain) => domain.domainName.toLowerCase()));
  const result: ImportRowResult = { created: 0, failed: [], skipped: 0 };
  let done = 0;
  for (const name of capped) {
    if (existing.has(name.toLowerCase())) {
      result.skipped += 1;
    } else {
      try {
        await createInventory('domains', { domainName: name });
        existing.add(name.toLowerCase());
        result.created += 1;
      } catch (error) {
        result.failed.push({
          name,
          reason: error instanceof Error ? error.message : 'Could not create this domain.',
        });
      }
    }
    done += 1;
    onProgress?.(done, capped.length);
  }
  if (names.length > capped.length) {
    result.failed.push({
      name: `${names.length - capped.length} more row(s)`,
      reason: `Imports are capped at ${MAX_IMPORT_ROWS} rows per file.`,
    });
  }
  return result;
}

/** Adds missing domains from a snapshot (notes/auto-renew preserved). */
export async function importBackupDomains(
  rows: ParsedBackup['domains'],
  onProgress?: (done: number, total: number) => void,
): Promise<ImportRowResult> {
  const capped = rows.slice(0, MAX_IMPORT_ROWS);
  const existing = new Set((await fetchAll('domains')).map((domain) => domain.domainName.toLowerCase()));
  const result: ImportRowResult = { created: 0, failed: [], skipped: 0 };
  let done = 0;
  for (const row of capped) {
    if (existing.has(row.domainName.toLowerCase())) {
      result.skipped += 1;
    } else {
      try {
        await createInventory('domains', {
          ...(row.autoRenew === null ? {} : { autoRenew: row.autoRenew }),
          domainName: row.domainName,
          ...(row.notes ? { notes: row.notes } : {}),
        });
        existing.add(row.domainName.toLowerCase());
        result.created += 1;
      } catch (error) {
        result.failed.push({
          name: row.domainName,
          reason: error instanceof Error ? error.message : 'Could not create this domain.',
        });
      }
    }
    done += 1;
    onProgress?.(done, capped.length);
  }
  return result;
}

export function describeImportResult(result: ImportRowResult, format: string): { description: string; message: string; type: 'error' | 'info' | 'success' } {
  if (result.created === 0 && result.failed.length > 0) {
    return {
      description: result.failed.slice(0, 3).map((entry) => `${entry.name}: ${entry.reason}`).join(' '),
      message: `No ${format.toUpperCase()} rows could be imported.`,
      type: 'error',
    };
  }
  const parts = [`${result.created} created`];
  if (result.skipped > 0) parts.push(`${result.skipped} already existed`);
  if (result.failed.length > 0) parts.push(`${result.failed.length} failed`);
  return {
    description: parts.join(', ') + '.',
    message: `Imported ${result.created} domain${result.created === 1 ? '' : 's'} from ${format.toUpperCase()}.`,
    type: result.failed.length > 0 ? 'info' : 'success',
  };
}
