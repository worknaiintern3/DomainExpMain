import type {
  AvailabilityCurrentStatus,
  AvailabilityFailureCode,
  AvailabilityRunStatus,
} from '@/api/server-availability';

import { formatDateTime } from '@/lib/format';
export function observedStatus(status: AvailabilityRunStatus | null): AvailabilityCurrentStatus {
  if (status === 'AVAILABLE') return 'UP';
  if (status === 'UNAVAILABLE') return 'DOWN';
  return 'UNKNOWN';
}

export function statusVariant(status: AvailabilityCurrentStatus): 'healthy' | 'critical' | 'neutral' {
  if (status === 'UP') return 'healthy';
  if (status === 'DOWN') return 'critical';
  return 'neutral';
}

export function runStatusLabel(status: AvailabilityRunStatus): string {
  if (status === 'QUEUED') return 'Queued';
  if (status === 'RUNNING') return 'Running';
  return observedStatus(status);
}

const FAILURE_LABELS: Record<AvailabilityFailureCode, string> = {
  NO_TARGET_ADDRESS: 'No address is recorded for the selected source',
  UNSAFE_NETWORK_TARGET: 'The selected network address is not permitted',
  DNS_LOOKUP_FAILED: 'Hostname lookup failed',
  CONNECT_TIMEOUT: 'Connection timed out',
  CONNECTION_REFUSED: 'Connection refused',
  NETWORK_UNREACHABLE: 'Network unreachable',
  CONNECTION_RESET: 'Connection reset',
  SERVER_NOT_TRACKED: 'Server was no longer tracked',
  WORKER_LEASE_EXPIRED: 'Check worker timed out; availability is unknown',
  UNEXPECTED_PROBE_ERROR: 'The check could not be completed',
};

export function failureLabel(code: AvailabilityFailureCode | null): string {
  return code ? FAILURE_LABELS[code] : 'None';
}

export function formatAvailabilityDate(value: string | null, empty = 'Not recorded'): string {
  return formatDateTime(value, empty);
}

export function formatLatency(value: number | null): string {
  return value === null ? 'Not recorded' : `${value} ms`;
}
