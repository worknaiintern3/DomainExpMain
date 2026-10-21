import { apiRequest } from './client';

export type AvailabilityCurrentStatus = 'UP' | 'DOWN' | 'UNKNOWN';
export type AvailabilityResultStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'ERROR';
export type AvailabilityRunStatus = 'QUEUED' | 'RUNNING' | AvailabilityResultStatus;
export type AvailabilityAddressSource = 'PRIMARY_IP' | 'HOSTNAME';
export type AvailabilityTrigger = 'SCHEDULED' | 'MANUAL' | 'RETRY';
export type AvailabilityFailureCode =
  | 'NO_TARGET_ADDRESS'
  | 'UNSAFE_NETWORK_TARGET'
  | 'DNS_LOOKUP_FAILED'
  | 'CONNECT_TIMEOUT'
  | 'CONNECTION_REFUSED'
  | 'NETWORK_UNREACHABLE'
  | 'CONNECTION_RESET'
  | 'SERVER_NOT_TRACKED'
  | 'WORKER_LEASE_EXPIRED'
  | 'UNEXPECTED_PROBE_ERROR';

export interface ServerAvailabilityTarget {
  id: string;
  serverId: string;
  enabled: boolean;
  addressSource: AvailabilityAddressSource;
  port: number;
  checkIntervalMinutes: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: AvailabilityResultStatus | null;
  currentStatus: AvailabilityCurrentStatus;
  lastLatencyMs: number | null;
  lastFailureCode: AvailabilityFailureCode | null;
  consecutiveFailures: number;
  lastRecoveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ServerAvailabilityTargetApiResponse =
  | { configured: false; serverId: string; currentStatus: 'UNKNOWN' }
  | { configured: true; target: ServerAvailabilityTarget };

export interface ServerAvailabilityRun {
  id: string;
  serverId: string;
  targetId: string;
  trigger: AvailabilityTrigger;
  status: AvailabilityRunStatus;
  attemptNo: number;
  availableAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  latencyMs: number | null;
  failureCode: AvailabilityFailureCode | null;
  retryOfRunId: string | null;
  createdAt: string;
}

export interface ServerAvailabilityRunPage {
  items: ServerAvailabilityRun[];
  nextCursor: string | null;
}

export interface UpdateServerAvailabilityTarget {
  enabled?: boolean;
  addressSource?: AvailabilityAddressSource;
  port?: number;
  checkIntervalMinutes?: number;
}

const pathFor = (serverId: string) => `/servers/${encodeURIComponent(serverId)}/availability`;

export function getServerAvailability(
  serverId: string,
  signal?: AbortSignal,
): Promise<ServerAvailabilityTargetApiResponse> {
  return apiRequest(pathFor(serverId), { signal });
}

export function putServerAvailability(
  serverId: string,
  body: UpdateServerAvailabilityTarget,
): Promise<ServerAvailabilityTargetApiResponse> {
  return apiRequest(pathFor(serverId), { method: 'PUT', body });
}

export function listServerAvailabilityRuns(
  serverId: string,
  query: { cursor?: string; limit?: number; status?: AvailabilityRunStatus; trigger?: AvailabilityTrigger } = {},
  signal?: AbortSignal,
): Promise<ServerAvailabilityRunPage> {
  const search = new URLSearchParams();
  if (query.cursor) search.set('cursor', query.cursor);
  if (query.limit !== undefined) search.set('limit', String(query.limit));
  if (query.status) search.set('status', query.status);
  if (query.trigger) search.set('trigger', query.trigger);
  const suffix = search.toString();
  return apiRequest(`${pathFor(serverId)}/runs${suffix ? `?${suffix}` : ''}`, { signal });
}

export function postServerAvailabilityRun(
  serverId: string,
  idempotencyKey: string,
): Promise<{ id: string; status: AvailabilityRunStatus; trigger: 'MANUAL' }> {
  return apiRequest(`${pathFor(serverId)}/runs`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}
