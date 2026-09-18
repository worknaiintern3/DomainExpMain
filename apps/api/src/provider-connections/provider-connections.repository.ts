import { createHash } from 'node:crypto';

import {
  providerAccounts,
  providerConnections,
  providerSyncRuns,
  type DatabaseTransaction,
  type DatabaseTransactionOperation,
} from '@domainpulse/database';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { DISCONNECTED_CREDENTIAL_MASK } from './provider-connection-mask';
import { InvalidProviderAccountError } from './provider-connections.errors';
import {
  AUTH_TYPE_PROVIDER_KEY,
  type CreateProviderConnectionRecordInput,
  type ProviderConnectionEnvelope,
  type ProviderConnectionSummary,
  type ProviderConnectionsStore,
  type ProviderSyncRunSummary,
  type ReplaceCredentialInput,
  type ValidationResultInput,
} from './provider-connections.types';

const DEFAULT_SYNC_RUNS_LIMIT = 20;

export interface ProviderConnectionsDatabaseHost {
  withWorkspaceContext<T>(
    workspaceId: string,
    operation: DatabaseTransactionOperation<T>,
  ): Promise<T>;
}

function connectionSummaryColumns() {
  return {
    authType: providerConnections.authType,
    connectionStatus: providerConnections.connectionStatus,
    createdAt: providerConnections.createdAt,
    credentialMask: providerConnections.credentialMask,
    disconnectedAt: providerConnections.disconnectedAt,
    id: providerConnections.id,
    lastSyncAt: providerConnections.lastSyncAt,
    lastValidatedAt: providerConnections.lastValidatedAt,
    nextSyncAt: providerConnections.nextSyncAt,
    providerAccountId: providerConnections.providerAccountId,
    providerAccountLabel: providerAccounts.label,
    providerType: providerAccounts.providerKey,
    syncStatus: providerConnections.syncStatus,
    updatedAt: providerConnections.updatedAt,
    validationErrorCode: providerConnections.validationErrorCode,
    validationStatus: providerConnections.validationStatus,
  } as const;
}

function initialIdempotencyKey(connectionId: string): string {
  return createHash('sha256').update(`${connectionId}:initial`).digest('hex');
}

export class PostgresProviderConnectionsRepository implements ProviderConnectionsStore {
  constructor(private readonly host: ProviderConnectionsDatabaseHost) {}

  async findSummaryById(
    workspaceId: string,
    id: string,
  ): Promise<ProviderConnectionSummary | undefined> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [row] = await transaction
        .select(connectionSummaryColumns())
        .from(providerConnections)
        .innerJoin(
          providerAccounts,
          and(
            eq(providerAccounts.workspaceId, providerConnections.workspaceId),
            eq(providerAccounts.id, providerConnections.providerAccountId),
          ),
        )
        .where(
          and(
            eq(providerConnections.workspaceId, workspaceId),
            eq(providerConnections.id, id),
          ),
        )
        .limit(1);
      return row;
    });
  }

  async listSummaries(workspaceId: string): Promise<readonly ProviderConnectionSummary[]> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const rows = await transaction
        .select(connectionSummaryColumns())
        .from(providerConnections)
        .innerJoin(
          providerAccounts,
          and(
            eq(providerAccounts.workspaceId, providerConnections.workspaceId),
            eq(providerAccounts.id, providerConnections.providerAccountId),
          ),
        )
        .where(eq(providerConnections.workspaceId, workspaceId))
        .orderBy(desc(providerConnections.createdAt));
      return rows;
    });
  }

  async findEnvelopeById(
    workspaceId: string,
    id: string,
  ): Promise<ProviderConnectionEnvelope | undefined> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [row] = await transaction
        .select({
          authType: providerConnections.authType,
          connectionStatus: providerConnections.connectionStatus,
          encryptedCiphertext: providerConnections.encryptedCiphertext,
          encryptionAuthTag: providerConnections.encryptionAuthTag,
          encryptionIv: providerConnections.encryptionIv,
          id: providerConnections.id,
          keyVersion: providerConnections.keyVersion,
          providerAccountId: providerConnections.providerAccountId,
        })
        .from(providerConnections)
        .where(
          and(
            eq(providerConnections.workspaceId, workspaceId),
            eq(providerConnections.id, id),
          ),
        )
        .limit(1);
      return row ? { ...row, workspaceId } : undefined;
    });
  }

  async createConnection(
    workspaceId: string,
    input: CreateProviderConnectionRecordInput,
    now: Date,
  ): Promise<ProviderConnectionSummary> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      // Resolved and validated inside the same transaction that persists the
      // connection, so there is no TOCTOU window between checking the
      // provider account and attaching a connection to it: it must exist,
      // belong to this workspace, and match the auth type's required
      // provider key (e.g. a CLOUDFLARE_API_TOKEN connection may only
      // attach to a 'cloudflare' provider account).
      const [account] = await transaction
        .select({ label: providerAccounts.label, providerKey: providerAccounts.providerKey })
        .from(providerAccounts)
        .where(
          and(
            eq(providerAccounts.workspaceId, workspaceId),
            eq(providerAccounts.id, input.providerAccountId),
          ),
        )
        .limit(1);
      if (account?.providerKey !== AUTH_TYPE_PROVIDER_KEY[input.authType]) {
        throw new InvalidProviderAccountError();
      }

      const [inserted] = await transaction
        .insert(providerConnections)
        .values({
          authType: input.authType,
          connectionStatus: 'CONNECTED',
          createdAt: now,
          credentialMask: input.credentialMask,
          encryptedCiphertext: input.encryptedCiphertext,
          encryptionAuthTag: input.encryptionAuthTag,
          encryptionIv: input.encryptionIv,
          id: input.id,
          keyVersion: input.keyVersion,
          lastValidatedAt: input.validatedAt,
          nextSyncAt: new Date(now.getTime() + 1_440 * 60_000),
          providerAccountId: input.providerAccountId,
          updatedAt: now,
          validationStatus: 'VALID',
          workspaceId,
        })
        .returning({ id: providerConnections.id });
      if (!inserted) {
        throw new Error('Failed to create provider connection');
      }

      // INITIAL sync runs are inserted directly by ordinary workspace-scoped
      // DML, matching the Phase 9 monitoring precedent documented on
      // provider_sync_runs (Phase 10C only reserves SECURITY DEFINER
      // functions for the cross-workspace schedule/claim/reclaim queue ops).
      await transaction.insert(providerSyncRuns).values({
        attemptNo: 1,
        availableAt: now,
        connectionId: input.id,
        createdAt: now,
        idempotencyKey: initialIdempotencyKey(input.id),
        status: 'QUEUED',
        trigger: 'INITIAL',
        workspaceId,
      });

      return {
        authType: input.authType,
        connectionStatus: 'CONNECTED',
        createdAt: now,
        credentialMask: input.credentialMask,
        disconnectedAt: null,
        id: input.id,
        lastSyncAt: null,
        lastValidatedAt: input.validatedAt,
        nextSyncAt: new Date(now.getTime() + 1_440 * 60_000),
        providerAccountId: input.providerAccountId,
        providerAccountLabel: account.label,
        providerType: account.providerKey,
        syncStatus: 'IDLE',
        updatedAt: now,
        validationErrorCode: null,
        validationStatus: 'VALID',
      };
    });
  }

  async replaceCredential(
    workspaceId: string,
    id: string,
    input: ReplaceCredentialInput,
  ): Promise<ProviderConnectionSummary | undefined> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [updated] = await transaction
        .update(providerConnections)
        .set({
          credentialMask: input.credentialMask,
          encryptedCiphertext: input.encryptedCiphertext,
          encryptionAuthTag: input.encryptionAuthTag,
          encryptionIv: input.encryptionIv,
          keyVersion: input.keyVersion,
          lastValidatedAt: input.validatedAt,
          updatedAt: input.validatedAt,
          validationErrorCode: null,
          validationStatus: 'VALID',
        })
        .where(
          and(
            eq(providerConnections.workspaceId, workspaceId),
            eq(providerConnections.id, id),
            eq(providerConnections.connectionStatus, 'CONNECTED'),
          ),
        )
        .returning({ id: providerConnections.id });
      if (!updated) return undefined;
      return this.selectSummaryInTransaction(transaction, workspaceId, id);
    });
  }

  async updateValidationResult(
    workspaceId: string,
    id: string,
    input: ValidationResultInput,
  ): Promise<ProviderConnectionSummary | undefined> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [updated] = await transaction
        .update(providerConnections)
        .set({
          lastValidatedAt: input.validatedAt,
          updatedAt: input.validatedAt,
          validationErrorCode: input.validationErrorCode,
          validationStatus: input.validationStatus,
        })
        .where(
          and(
            eq(providerConnections.workspaceId, workspaceId),
            eq(providerConnections.id, id),
            eq(providerConnections.connectionStatus, 'CONNECTED'),
          ),
        )
        .returning({ id: providerConnections.id });
      if (!updated) return undefined;
      return this.selectSummaryInTransaction(transaction, workspaceId, id);
    });
  }

  async disconnect(
    workspaceId: string,
    id: string,
    now: Date,
  ): Promise<{ connectionStatus: 'DISCONNECTED'; disconnectedAt: Date; id: string } | undefined> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [updated] = await transaction
        .update(providerConnections)
        .set({
          connectionStatus: 'DISCONNECTED',
          credentialMask: DISCONNECTED_CREDENTIAL_MASK,
          disconnectedAt: now,
          encryptedCiphertext: null,
          encryptionAuthTag: null,
          encryptionIv: null,
          keyVersion: null,
          nextSyncAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(providerConnections.workspaceId, workspaceId),
            eq(providerConnections.id, id),
            eq(providerConnections.connectionStatus, 'CONNECTED'),
          ),
        )
        .returning({ disconnectedAt: providerConnections.disconnectedAt, id: providerConnections.id });
      if (updated) {
        return {
          connectionStatus: 'DISCONNECTED' as const,
          disconnectedAt: updated.disconnectedAt ?? now,
          id: updated.id,
        };
      }

      // Idempotent: a connection already disconnected returns its existing
      // disconnected state instead of failing the second request.
      const [existing] = await transaction
        .select({
          connectionStatus: providerConnections.connectionStatus,
          disconnectedAt: providerConnections.disconnectedAt,
          id: providerConnections.id,
        })
        .from(providerConnections)
        .where(
          and(
            eq(providerConnections.workspaceId, workspaceId),
            eq(providerConnections.id, id),
          ),
        )
        .limit(1);
      if (existing?.connectionStatus !== 'DISCONNECTED' || !existing.disconnectedAt) {
        return undefined;
      }
      return {
        connectionStatus: 'DISCONNECTED' as const,
        disconnectedAt: existing.disconnectedAt,
        id: existing.id,
      };
    });
  }

  async listSyncRuns(
    workspaceId: string,
    connectionId: string,
    limit: number,
  ): Promise<readonly ProviderSyncRunSummary[]> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const rows = await transaction
        .select({
          attemptNo: providerSyncRuns.attemptNo,
          createdAt: providerSyncRuns.createdAt,
          durationMs: providerSyncRuns.durationMs,
          errorCode: providerSyncRuns.errorCode,
          finishedAt: providerSyncRuns.finishedAt,
          id: providerSyncRuns.id,
          itemsCreated: providerSyncRuns.itemsCreated,
          itemsDiscovered: providerSyncRuns.itemsDiscovered,
          itemsMissing: providerSyncRuns.itemsMissing,
          itemsUnchanged: providerSyncRuns.itemsUnchanged,
          itemsUpdated: providerSyncRuns.itemsUpdated,
          startedAt: providerSyncRuns.startedAt,
          status: providerSyncRuns.status,
          trigger: providerSyncRuns.trigger,
        })
        .from(providerSyncRuns)
        .where(
          and(
            eq(providerSyncRuns.workspaceId, workspaceId),
            eq(providerSyncRuns.connectionId, connectionId),
          ),
        )
        .orderBy(desc(providerSyncRuns.createdAt))
        .limit(Math.min(limit, DEFAULT_SYNC_RUNS_LIMIT * 5));
      return rows;
    });
  }

  async findActiveRun(
    workspaceId: string,
    connectionId: string,
  ): Promise<{ id: string } | undefined> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [row] = await transaction
        .select({ id: providerSyncRuns.id })
        .from(providerSyncRuns)
        .where(
          and(
            eq(providerSyncRuns.workspaceId, workspaceId),
            eq(providerSyncRuns.connectionId, connectionId),
            inArray(providerSyncRuns.status, ['QUEUED', 'RUNNING']),
          ),
        )
        .orderBy(desc(providerSyncRuns.createdAt))
        .limit(1);
      return row;
    });
  }

  async findRunByIdempotencyKey(
    workspaceId: string,
    connectionId: string,
    internalIdempotencyKey: string,
  ): Promise<{ id: string } | undefined> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [row] = await transaction
        .select({ id: providerSyncRuns.id })
        .from(providerSyncRuns)
        .where(
          and(
            eq(providerSyncRuns.workspaceId, workspaceId),
            eq(providerSyncRuns.connectionId, connectionId),
            eq(providerSyncRuns.idempotencyKey, internalIdempotencyKey),
          ),
        )
        .limit(1);
      return row;
    });
  }

  async createManualSyncRun(
    workspaceId: string,
    connectionId: string,
    internalIdempotencyKey: string,
    now: Date,
  ): Promise<{ id: string }> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      // Deliberately never touches provider_connections.next_sync_at: a
      // manual sync must not alter the scheduled recurring cadence.
      const [inserted] = await transaction
        .insert(providerSyncRuns)
        .values({
          attemptNo: 1,
          availableAt: now,
          connectionId,
          createdAt: now,
          idempotencyKey: internalIdempotencyKey,
          status: 'QUEUED',
          trigger: 'MANUAL',
          workspaceId,
        })
        .returning({ id: providerSyncRuns.id });
      if (!inserted) {
        throw new Error('Failed to create manual provider sync run');
      }
      return inserted;
    });
  }

  private async selectSummaryInTransaction(
    transaction: DatabaseTransaction,
    workspaceId: string,
    id: string,
  ): Promise<ProviderConnectionSummary | undefined> {
    const [row] = await transaction
      .select(connectionSummaryColumns())
      .from(providerConnections)
      .innerJoin(
        providerAccounts,
        and(
          eq(providerAccounts.workspaceId, providerConnections.workspaceId),
          eq(providerAccounts.id, providerConnections.providerAccountId),
        ),
      )
      .where(
        and(
          eq(providerConnections.workspaceId, workspaceId),
          eq(providerConnections.id, id),
        ),
      )
      .limit(1);
    return row;
  }
}
