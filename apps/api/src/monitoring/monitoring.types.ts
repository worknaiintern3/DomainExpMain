import type { DatabaseTransactionOperation } from '@domainpulse/database';

export type MonitoringRunTrigger = 'SCHEDULED' | 'MANUAL' | 'RETRY';
export type MonitoringRunStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
export type MonitoringResultStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';
export type AlertRuleKey =
  | 'DOMAIN_EXPIRY_CRITICAL'
  | 'DOMAIN_EXPIRY_WARNING'
  | 'TLS_EXPIRY_CRITICAL'
  | 'TLS_EXPIRY_WARNING'
  | 'RETRIEVAL_FAILURE_REPEATED'
  | 'DNS_CHANGED'
  | 'CERT_CHANGED';
export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type AlertEventStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface MonitoringTarget {
  readonly id: string;
  readonly workspaceId: string;
  readonly domainId: string;
  readonly enabled: boolean;
  readonly checkIntervalMinutes: number;
  readonly nextRunAt: Date | null;
  readonly lastRunAt: Date | null;
  readonly lastRunStatus: MonitoringResultStatus | null;
  readonly consecutiveFailures: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface MonitoringRun {
  readonly id: string;
  readonly workspaceId: string;
  readonly targetId: string;
  readonly domainId: string;
  readonly trigger: MonitoringRunTrigger;
  readonly status: MonitoringRunStatus;
  readonly availableAt: Date;
  readonly claimedAt: Date | null;
  readonly leaseExpiresAt: Date | null;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly durationMs: number | null;
  readonly attemptNo: number;
  readonly idempotencyKey: string;
  readonly errorCode: string | null;
  readonly sourcesAttempted: readonly string[];
  readonly sourcesSucceeded: readonly string[];
  readonly runMetadata: Record<string, unknown>;
  readonly createdAt: Date;
}

export interface AlertRule {
  readonly id: string;
  readonly workspaceId: string;
  readonly key: AlertRuleKey;
  readonly enabled: boolean;
  readonly severity: AlertSeverity;
  readonly thresholdDays: number | null;
  readonly thresholdCount: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AlertEvent {
  readonly id: string;
  readonly workspaceId: string;
  readonly ruleId: string | null;
  readonly domainId: string;
  readonly targetId: string | null;
  readonly dedupeKey: string;
  readonly severity: AlertSeverity;
  readonly status: AlertEventStatus;
  readonly title: string;
  readonly detail: string;
  readonly evidence: Record<string, unknown>;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly resolvedAt: Date | null;
  readonly ackedAt: Date | null;
  readonly ackedByUserId: string | null;
  readonly occurrenceCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface MonitoringTargetCreateInput {
  readonly domainId: string;
  enabled?: boolean;
  checkIntervalMinutes?: number;
}

export interface MonitoringTargetUpdateInput {
  readonly enabled?: boolean;
  readonly checkIntervalMinutes?: number;
}

export interface MonitoringRunCreateInput {
  readonly targetId: string;
  readonly domainId: string;
  readonly trigger: MonitoringRunTrigger;
  readonly idempotencyKey: string;
  readonly runMetadata?: Record<string, unknown>;
}

export interface AlertRuleUpdateInput {
  readonly enabled?: boolean;
  readonly severity?: AlertSeverity;
  readonly thresholdDays?: number | null;
  readonly thresholdCount?: number | null;
}

export interface AlertsListQuery {
  readonly cursor?: string;
  readonly limit?: number;
  readonly status?: AlertEventStatus;
  readonly severity?: AlertSeverity;
  readonly ruleKey?: AlertRuleKey;
  readonly domainId?: string;
}

export interface MonitoringRunsListQuery {
  readonly cursor?: string;
  readonly limit?: number;
  readonly status?: MonitoringRunStatus;
  readonly trigger?: MonitoringRunTrigger;
}

export interface CursorPosition {
  readonly createdAt: string;
  readonly id: string;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface MonitoringStore {
  findTargetByDomainId(
    workspaceId: string,
    domainId: string,
  ): Promise<MonitoringTarget | undefined>;
  createTarget(
    workspaceId: string,
    input: MonitoringTargetCreateInput,
    now: Date,
  ): Promise<MonitoringTarget>;
  updateTarget(
    workspaceId: string,
    targetId: string,
    input: MonitoringTargetUpdateInput,
    now: Date,
  ): Promise<MonitoringTarget | undefined>;
  findRunByIdempotencyKey(
    workspaceId: string,
    targetId: string,
    idempotencyKey: string,
  ): Promise<MonitoringRun | undefined>;
  createRun(
    workspaceId: string,
    input: MonitoringRunCreateInput,
    now: Date,
  ): Promise<MonitoringRun>;
  listRuns(
    workspaceId: string,
    domainId: string,
    query: MonitoringRunsListQuery,
  ): Promise<Page<MonitoringRun>>;
  listAlerts(
    workspaceId: string,
    query: AlertsListQuery,
  ): Promise<Page<AlertEvent>>;
  findAlertById(
    workspaceId: string,
    alertId: string,
  ): Promise<AlertEvent | undefined>;
  acknowledgeAlert(
    workspaceId: string,
    alertId: string,
    userId: string,
    now: Date,
  ): Promise<AlertEvent | undefined>;
  listAlertRules(workspaceId: string): Promise<readonly AlertRule[]>;
  findAlertRuleByKey(
    workspaceId: string,
    key: AlertRuleKey,
  ): Promise<AlertRule | undefined>;
  upsertAlertRule(
    workspaceId: string,
    key: AlertRuleKey,
    input: AlertRuleUpdateInput,
    now: Date,
  ): Promise<AlertRule>;
  withWorkspaceContext<T>(
    workspaceId: string,
    operation: DatabaseTransactionOperation<T>,
  ): Promise<T>;
}

export interface MonitoringDatabaseHost {
  withWorkspaceContext<T>(
    workspaceId: string,
    operation: DatabaseTransactionOperation<T>,
  ): Promise<T>;
}