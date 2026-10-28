import type { ServerProviderMetadata, ServerProviderSpecs } from '@/api/types';

import { formatDate } from '@/lib/format';
const NOT_REPORTED = 'Not reported';

function formatDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
}

export function formatCpu(cpuCount: number | null | undefined): string | null {
  return cpuCount === null || cpuCount === undefined ? null : `${cpuCount} vCPU`;
}

export function formatMemory(memoryMb: number | null | undefined): string | null {
  return memoryMb === null || memoryMb === undefined
    ? null
    : `${formatDecimal(memoryMb / 1_024)} GB RAM`;
}

export function formatDisk(diskGb: number | null | undefined): string | null {
  return diskGb === null || diskGb === undefined ? null : `${formatDecimal(diskGb)} GB disk`;
}

/** Compact, single-line summary for list/table contexts; never invents a value. */
export function formatSpecsCompact(specs: ServerProviderSpecs | null | undefined): string {
  if (!specs) return NOT_REPORTED;
  const parts = [formatCpu(specs.cpuCount), formatMemory(specs.memoryMb), formatDisk(specs.diskGb)]
    .filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(' · ') : NOT_REPORTED;
}

export function formatProviderStatus(status: string | null | undefined): string {
  return status && status.trim().length > 0 ? status : NOT_REPORTED;
}

export function formatProviderCreatedAt(value: string | null | undefined): string {
  if (!value) return NOT_REPORTED;
  return formatDate(value, value);
}

function humanizeDetailKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/gu, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Ordered [label, value] pairs for provider-specific OS detail; empty when none is present. */
export function operatingSystemDetailEntries(
  detail: Readonly<Record<string, string>> | null | undefined,
): ReadonlyArray<readonly [string, string]> {
  if (!detail) return [];
  return Object.entries(detail).map(([key, value]) => [humanizeDetailKey(key), value] as const);
}

export function hasProviderMetadata(
  metadata: ServerProviderMetadata | null | undefined,
): metadata is ServerProviderMetadata {
  return metadata !== null && metadata !== undefined;
}

export function extractProviderMetadataFromNotes(
  notes: string | null | undefined,
): ServerProviderMetadata | null {
  if (!notes) return null;
  const ramMatch = notes.match(/RAM:\s*(\d+)\s*MB/i);
  const diskMatch = notes.match(/Disk:\s*(\d+)\s*GB/i);
  const cpuMatch = notes.match(/CPU:\s*(\d+)\s*vCPU/i);
  const statusMatch = notes.match(/Status:\s*([a-zA-Z0-9_-]+)/i);

  if (!ramMatch && !diskMatch && !cpuMatch && !statusMatch) return null;

  return {
    operatingSystemDetail: null,
    providerCreatedAt: null,
    providerStatus: statusMatch ? statusMatch[1] : null,
    specs: {
      cpuCount: cpuMatch ? parseInt(cpuMatch[1], 10) : null,
      diskGb: diskMatch ? parseInt(diskMatch[1], 10) : null,
      memoryMb: ramMatch ? parseInt(ramMatch[1], 10) : null,
    },
  };
}
