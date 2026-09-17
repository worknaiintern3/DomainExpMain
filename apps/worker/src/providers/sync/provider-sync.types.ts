export type ProviderSyncTerminalStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface ClaimedProviderSyncRun {
  readonly attemptNo: number;
  readonly connectionId: string;
  readonly idempotencyKey: string;
  readonly leaseExpiresAt: Date;
  readonly runId: string;
  readonly workspaceId: string;
}

export interface ProviderConnectionForSync {
  readonly connectionStatus: 'CONNECTED' | 'DISCONNECTED';
  readonly encryptedCiphertext: string | null;
  readonly encryptionAuthTag: string | null;
  readonly encryptionIv: string | null;
  readonly id: string;
  readonly keyVersion: number | null;
  readonly providerKey: string;
  readonly workspaceId: string;
}

export interface ProviderSyncExecutionResult {
  readonly durationMs: number;
  readonly errorCode: string | null;
  readonly finishedAt: Date;
  readonly itemsCreated: number;
  readonly itemsDiscovered: number;
  readonly itemsMissing: number;
  readonly itemsUnchanged: number;
  readonly itemsUpdated: number;
  readonly status: ProviderSyncTerminalStatus;
}

export interface ProviderSyncQueueStore {
  assertSafeRuntimeRole(): Promise<void>;
  claim(now: Date, limit: number, leaseMs: number): Promise<readonly ClaimedProviderSyncRun[]>;
  close(): Promise<void>;
  finalize(run: ClaimedProviderSyncRun, result: ProviderSyncExecutionResult): Promise<boolean>;
  loadConnectionForSync(
    workspaceId: string,
    connectionId: string,
  ): Promise<ProviderConnectionForSync | undefined>;
  recoverExpired(now: Date, limit: number, maxRetries: number): Promise<number>;
  scheduleDue(now: Date, limit: number): Promise<number>;
}

export interface ProviderSyncRunExecutor {
  execute(
    run: ClaimedProviderSyncRun,
    connection: ProviderConnectionForSync,
  ): Promise<ProviderSyncExecutionResult>;
}

/**
 * Phase 10H (VPS providers): the resource-neutral shape `ProviderSyncExecutor`
 * actually depends on. `ProviderDomainSyncService` (domains) and the new
 * `ProviderServerSyncService` (VPS servers) both satisfy this structurally --
 * no changes to either concrete class are needed -- so the executor's
 * provider registry can hold either kind of sync service without a second
 * executor implementation.
 */
export interface ProviderResourceSyncInput {
  readonly connectionId: string;
  readonly synchronizedAt: Date;
  readonly token: string;
  readonly workspaceId: string;
}

export interface ProviderResourceSyncResult {
  readonly completion: 'COMPLETE' | 'PARTIAL';
  readonly error: {
    readonly code: string;
    readonly retryAfterSeconds: number | null;
  } | null;
  readonly itemsCreated: number;
  readonly itemsDiscovered: number;
  readonly itemsMissing: number;
  readonly itemsUnchanged: number;
  readonly itemsUpdated: number;
}

export interface ProviderResourceSyncService {
  synchronize(
    input: ProviderResourceSyncInput,
  ): Promise<ProviderResourceSyncResult>;
}

export interface ProviderSyncWorkerLogEvent {
  readonly count?: number;
  readonly event: string;
}

export interface ProviderSyncWorkerLogger {
  error(event: ProviderSyncWorkerLogEvent): void;
  info(event: ProviderSyncWorkerLogEvent): void;
}
