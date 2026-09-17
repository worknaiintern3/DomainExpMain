import type { SafeProviderError } from '../provider-adapter.types';

export type ProviderSyncTerminalStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

/**
 * Phase 10I: the shape both `ProviderDomainSyncService` (registrar/DNS
 * domains) and `ProviderCloudResourceSyncService` (AWS/GCP/Azure VM
 * inventory) already satisfy structurally -- their `synchronize` methods
 * take and return identically-shaped objects (see
 * provider-domain-reconciliation.types.ts /
 * provider-cloud-resource-reconciliation.types.ts). Declaring this common
 * interface here, rather than a second copy of the executor, lets
 * `ProviderSyncExecutor` dispatch to either kind through one
 * provider-key-keyed map without either service needing to import the other
 * or `implements` anything.
 */
export interface ProviderSyncServiceInput {
  readonly connectionId: string;
  readonly synchronizedAt: Date;
  readonly token: string;
  readonly workspaceId: string;
}

export interface ProviderSyncServiceResult {
  readonly completion: 'COMPLETE' | 'PARTIAL';
  readonly error: SafeProviderError | null;
  readonly itemsCreated: number;
  readonly itemsDiscovered: number;
  readonly itemsMissing: number;
  readonly itemsUnchanged: number;
  readonly itemsUpdated: number;
}

export interface ProviderSyncService {
  synchronize(input: ProviderSyncServiceInput): Promise<ProviderSyncServiceResult>;
}

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

export interface ProviderSyncWorkerLogEvent {
  readonly count?: number;
  readonly event: string;
}

export interface ProviderSyncWorkerLogger {
  error(event: ProviderSyncWorkerLogEvent): void;
  info(event: ProviderSyncWorkerLogEvent): void;
}
