import type {
  ClaimedMonitoringRun,
  MonitoringExecutionResult,
} from '../monitoring/monitoring.types';

export type AlertRuleKey =
  | 'DOMAIN_EXPIRY_CRITICAL'
  | 'DOMAIN_EXPIRY_WARNING'
  | 'TLS_EXPIRY_CRITICAL'
  | 'TLS_EXPIRY_WARNING'
  | 'RETRIEVAL_FAILURE_REPEATED'
  | 'DNS_CHANGED'
  | 'CERT_CHANGED';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type AlertActiveStatus = 'OPEN' | 'ACKNOWLEDGED';

export interface AlertRuleState {
  readonly enabled: boolean;
  readonly id: string;
  readonly key: AlertRuleKey;
  readonly severity: AlertSeverity;
  readonly thresholdCount: number | null;
  readonly thresholdDays: number | null;
}

export interface AlertRdapSnapshot {
  readonly expiresAt: Date | null;
  readonly retrievedAt: Date;
}

export interface AlertDnsMxRecord {
  readonly exchange: string;
  readonly priority: number;
}

export interface AlertDnsDsRecord {
  readonly algorithm: number;
  readonly digest: string;
  readonly digestType: number;
  readonly keyTag: number;
}

export type AlertDnsAttemptStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface AlertDnsSnapshot {
  readonly aRecords: readonly string[];
  readonly aaaaRecords: readonly string[];
  readonly cnameRecords: readonly string[];
  readonly dsRecords: readonly AlertDnsDsRecord[];
  readonly lastAttemptStatus: AlertDnsAttemptStatus;
  readonly mxRecords: readonly AlertDnsMxRecord[];
  readonly nsRecords: readonly string[];
  readonly retrievedAt: Date;
  readonly txtRecordCount: number;
}

export type AlertTlsAttemptStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface AlertTlsSnapshot {
  readonly fingerprint256: string | null;
  readonly issuerCommonName: string | null;
  readonly issuerOrganization: string | null;
  readonly lastAttemptStatus: AlertTlsAttemptStatus;
  readonly retrievedAt: Date;
  readonly serialNumber: string | null;
  readonly subjectAltNames: readonly string[];
  readonly subjectCommonName: string | null;
  readonly validFrom: Date | null;
  readonly validTo: Date | null;
}

export interface AlertSnapshotState {
  readonly dns: AlertDnsSnapshot | null;
  readonly rdap: AlertRdapSnapshot | null;
  readonly tls: AlertTlsSnapshot | null;
}

export interface ActiveAlertEventState {
  readonly dedupeKey: string;
  readonly id: string;
  readonly status: AlertActiveStatus;
}

export interface AlertEvaluationState {
  readonly activeEvents: readonly ActiveAlertEventState[];
  readonly consecutiveFailures: number | null;
  readonly rules: readonly AlertRuleState[];
  readonly snapshots: AlertSnapshotState;
}

export interface AlertEventInput {
  readonly dedupeKey: string;
  readonly detail: string;
  readonly domainId: string;
  readonly evidence: Record<string, unknown>;
  readonly now: Date;
  readonly ruleId: string;
  readonly severity: AlertSeverity;
  readonly targetId: string;
  readonly title: string;
  readonly workspaceId: string;
}

export interface ChangeBaseline {
  readonly dnsFingerprint: string | null;
  readonly tlsFingerprint: string | null;
}

export interface AlertEvaluationSummary {
  readonly opened: string[];
  readonly resolved: string[];
  readonly touched: string[];
}

export class AlertActiveConflictError extends Error {
  constructor(readonly dedupeKey: string) {
    super(`Active alert event already exists for ${dedupeKey}`);
    this.name = 'AlertActiveConflictError';
  }
}

export interface AlertStore {
  insertEvent(event: AlertEventInput): Promise<void>;
  loadEvaluationState(
    workspaceId: string,
    domainId: string,
    targetId: string,
  ): Promise<AlertEvaluationState>;
  readActiveEvents(
    workspaceId: string,
    domainId: string,
  ): Promise<readonly ActiveAlertEventState[]>;
  readSnapshots(
    workspaceId: string,
    domainId: string,
  ): Promise<AlertSnapshotState>;
  resolveByDedupe(
    workspaceId: string,
    dedupeKey: string,
    now: Date,
  ): Promise<void>;
  touchEvent(
    workspaceId: string,
    eventId: string,
    evidence: Record<string, unknown>,
    now: Date,
  ): Promise<void>;
}

export interface AlertEvaluationHooks {
  captureBaseline(
    run: ClaimedMonitoringRun,
  ): Promise<ChangeBaseline | null>;
  evaluateAfterRun(
    run: ClaimedMonitoringRun,
    result: MonitoringExecutionResult,
    baseline: ChangeBaseline | null,
  ): Promise<AlertEvaluationSummary>;
}

export interface AlertEvaluatorClock {
  readonly now: () => Date;
}
