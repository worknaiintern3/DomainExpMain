export type MonitoringSource = 'rdap' | 'dns' | 'tls';
export type MonitoringTerminalStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface ClaimedMonitoringRun {
  readonly attemptNo: number;
  readonly domainId: string;
  readonly idempotencyKey: string;
  readonly leaseExpiresAt: Date;
  readonly runId: string;
  readonly targetId: string;
  readonly workspaceId: string;
}

export interface MonitoringDomain {
  readonly normalizedDomainName: string;
}

export interface MonitoringExecutionResult {
  readonly durationMs: number;
  readonly errorCode: string | null;
  readonly finishedAt: Date;
  readonly retryable: boolean;
  readonly sourcesAttempted: readonly MonitoringSource[];
  readonly sourcesSucceeded: readonly MonitoringSource[];
  readonly status: MonitoringTerminalStatus;
}

export interface MonitoringQueueStore {
  assertSafeRuntimeRole(): Promise<void>;
  claim(now: Date, limit: number, leaseMs: number): Promise<readonly ClaimedMonitoringRun[]>;
  cleanupOldTerminalRuns?(now: Date, retentionDays: number, batchSize: number): Promise<number>;
  close(): Promise<void>;
  finalize(
    run: ClaimedMonitoringRun,
    result: MonitoringExecutionResult,
    maxRetries: number,
  ): Promise<boolean>;
  findDomain(run: ClaimedMonitoringRun): Promise<MonitoringDomain | undefined>;
  recoverExpired(now: Date, limit: number, maxRetries: number): Promise<number>;
  scheduleDue(now: Date, limit: number): Promise<number>;
}

export interface MonitoringRunExecutor {
  execute(
    run: ClaimedMonitoringRun,
    domain: MonitoringDomain,
  ): Promise<MonitoringExecutionResult>;
}

export interface WorkerLogEvent {
  readonly event: string;
  readonly count?: number;
}

export interface WorkerLogger {
  error(event: WorkerLogEvent): void;
  info(event: WorkerLogEvent): void;
}
