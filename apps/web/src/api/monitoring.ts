import { apiRequest } from './client';

export type MonitoringTargetResponse = {
  checkIntervalMinutes: number;
  consecutiveFailures: number;
  createdAt: string;
  domainId: string;
  enabled: boolean;
  id: string;
  lastRunAt: string | null;
  lastRunStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED' | null;
  nextRunAt: string | null;
  updatedAt: string;
};

export type MonitoringTargetApiResponse =
  | { configured: false; domainId: string }
  | { configured: true; target: MonitoringTargetResponse };

export type MonitoringRunResponse = {
  attemptNo: number;
  createdAt: string;
  domainId: string;
  durationMs: number | null;
  errorCode: string | null;
  finishedAt: string | null;
  id: string;
  sourcesAttempted: string[];
  sourcesSucceeded: string[];
  startedAt: string | null;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  targetId: string;
  trigger: 'SCHEDULED' | 'MANUAL' | 'RETRY';
};

export type MonitoringRunCollection = {
  items: MonitoringRunResponse[];
  nextCursor: string | null;
};

export type AlertEventResponse = {
  ackedAt: string | null;
  ackedByUserId: string | null;
  createdAt: string;
  detail: string;
  domainId: string;
  evidence: Record<string, unknown>;
  firstSeenAt: string;
  id: string;
  lastSeenAt: string;
  occurrenceCount: number;
  resolvedAt: string | null;
  ruleId: string | null;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  targetId: string | null;
  title: string;
  updatedAt: string;
};

export type AlertCollection = {
  items: AlertEventResponse[];
  nextCursor: string | null;
};

export type AlertRuleResponse = {
  createdAt: string;
  enabled: boolean;
  id: string;
  key: 'DOMAIN_EXPIRY_CRITICAL' | 'DOMAIN_EXPIRY_WARNING' | 'TLS_EXPIRY_CRITICAL' | 'TLS_EXPIRY_WARNING' | 'RETRIEVAL_FAILURE_REPEATED' | 'DNS_CHANGED' | 'CERT_CHANGED';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  thresholdCount: number | null;
  thresholdDays: number | null;
  updatedAt: string;
};

export function getMonitoringTarget(domainId: string, signal?: AbortSignal): Promise<MonitoringTargetApiResponse> {
  return apiRequest(`/domains/${encodeURIComponent(domainId)}/monitoring`, { signal });
}

export function putMonitoringTarget(
  domainId: string,
  body: { enabled?: boolean; checkIntervalMinutes?: number },
): Promise<MonitoringTargetApiResponse> {
  return apiRequest(`/domains/${encodeURIComponent(domainId)}/monitoring`, {
    body,
    method: 'PUT',
  });
}

export function listMonitoringRuns(
  domainId: string,
  query?: { cursor?: string; limit?: number; status?: string; trigger?: string },
  signal?: AbortSignal,
): Promise<MonitoringRunCollection> {
  const search = new URLSearchParams();
  if (query?.cursor) search.set('cursor', query.cursor);
  if (query?.limit) search.set('limit', String(query.limit));
  if (query?.status) search.set('status', query.status);
  if (query?.trigger) search.set('trigger', query.trigger);
  const qs = search.toString();
  return apiRequest(`/domains/${encodeURIComponent(domainId)}/monitoring/runs${qs ? `?${qs}` : ''}`, { signal });
}

export function postManualRun(domainId: string, idempotencyKey: string): Promise<{ id: string; status: 'QUEUED'; trigger: 'MANUAL'; message: string }> {
  return apiRequest(`/domains/${encodeURIComponent(domainId)}/monitoring/runs`, {
    headers: { 'Idempotency-Key': idempotencyKey },
    method: 'POST',
  });
}

export function listAlerts(
  query?: { cursor?: string; limit?: number; status?: string; severity?: string; ruleKey?: string; domainId?: string },
  signal?: AbortSignal,
): Promise<AlertCollection> {
  const search = new URLSearchParams();
  if (query?.cursor) search.set('cursor', query.cursor);
  if (query?.limit) search.set('limit', String(query.limit));
  if (query?.status) search.set('status', query.status);
  if (query?.severity) search.set('severity', query.severity);
  if (query?.ruleKey) search.set('ruleKey', query.ruleKey);
  if (query?.domainId) search.set('domainId', query.domainId);
  const qs = search.toString();
  return apiRequest(`/alerts${qs ? `?${qs}` : ''}`, { signal });
}

export function acknowledgeAlert(alertId: string): Promise<{ id: string; status: 'ACKNOWLEDGED'; acknowledgedAt: string; acknowledgedByUserId: string }> {
  return apiRequest(`/alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: 'POST' });
}

export function listAlertRules(signal?: AbortSignal): Promise<AlertRuleResponse[]> {
  return apiRequest('/alert-rules', { signal });
}

export function patchAlertRule(
  key: string,
  body: { enabled?: boolean; severity?: 'CRITICAL' | 'WARNING' | 'INFO'; thresholdDays?: number | null; thresholdCount?: number | null },
): Promise<AlertRuleResponse> {
  return apiRequest(`/alert-rules/${encodeURIComponent(key)}`, { body, method: 'PATCH' });
}
