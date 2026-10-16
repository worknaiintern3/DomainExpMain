import { createHash, randomUUID } from 'node:crypto';

import {
  ProviderConnectionAlreadyExistsError,
  ProviderConnectionPersistenceError,
} from './provider-connections.errors';
import type {
  CreateProviderConnectionRecordInput,
  ProviderConnectionEnvelope,
  ProviderConnectionsStore,
  ProviderConnectionSummary,
  ProviderSyncRunSummary,
  ReplaceCredentialInput,
  ValidationResultInput,
} from './provider-connections.types';
import type { DatabaseService } from '../database/database.service';

const UUID_REGEX =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;

export function ensureValidUuid(id: string): string {
  if (id && UUID_REGEX.test(id)) return id;
  const hex = (id || '').replace(/[^0-9a-fA-F]/g, '').padEnd(32, '0').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function initialIdempotencyKey(connectionId: string): string {
  return createHash('sha256').update(`${connectionId}:initial`).digest('hex');
}

export class MongoProviderConnectionsRepository
  implements ProviderConnectionsStore
{
  constructor(private readonly database: DatabaseService) {}

  private async mapSummary(
    conn: any,
    workspaceId: string,
  ): Promise<ProviderConnectionSummary> {
    const cols = this.database.collections;
    const account = cols
      ? await cols.providerAccounts.findOne({
          workspaceId,
          id: conn.providerAccountId,
        })
      : null;

    return {
      id: conn.id,
      providerAccountId: conn.providerAccountId,
      providerAccountLabel: (account as any)?.label ?? (account as any)?.name ?? '',
      providerType: (account as any)?.providerKey ?? (account as any)?.provider ?? '',
      authType: conn.authType,
      credentialMask: conn.credentialMask,
      validationStatus: conn.validationStatus,
      validationErrorCode: conn.validationErrorCode ?? null,
      lastValidatedAt: conn.lastValidatedAt ?? null,
      syncStatus: conn.syncStatus ?? 'IDLE',
      lastSyncAt: conn.lastSyncAt ?? null,
      nextSyncAt: conn.nextSyncAt ?? null,
      connectionStatus: conn.connectionStatus ?? 'CONNECTED',
      disconnectedAt: conn.disconnectedAt ?? null,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    };
  }

  async findSummaryById(
    workspaceId: string,
    id: string,
  ): Promise<ProviderConnectionSummary | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const conn = await (cols.providerConnections as any).findOne({
      workspaceId,
      id,
    });
    if (!conn) return undefined;

    return await this.mapSummary(conn, workspaceId);
  }

  async listSummaries(
    workspaceId: string,
  ): Promise<readonly ProviderConnectionSummary[]> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const conns = await (cols.providerConnections as any)
      .find({ workspaceId })
      .sort({ createdAt: -1 })
      .toArray();

    return await Promise.all(
      conns.map((conn: any) => this.mapSummary(conn, workspaceId)),
    );
  }

  async findEnvelopeById(
    workspaceId: string,
    id: string,
  ): Promise<ProviderConnectionEnvelope | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const conn = await (cols.providerConnections as any).findOne({
      workspaceId,
      id,
    });
    if (!conn) return undefined;

    return {
      id: conn.id,
      workspaceId: conn.workspaceId,
      providerAccountId: conn.providerAccountId,
      authType: conn.authType,
      connectionStatus: conn.connectionStatus,
      encryptedCiphertext: conn.credentialsCiphertext ?? conn.encryptedCiphertext ?? null,
      encryptionIv: conn.credentialsIv ?? conn.encryptionIv ?? null,
      encryptionAuthTag: conn.credentialsTag ?? conn.encryptionAuthTag ?? null,
      keyVersion: conn.credentialsKeyVersion ?? conn.keyVersion ?? null,
    };
  }

  async createConnection(
    workspaceId: string,
    input: CreateProviderConnectionRecordInput,
    now: Date,
  ): Promise<ProviderConnectionSummary> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const doc = {
      id: input.id,
      workspaceId,
      providerAccountId: input.providerAccountId,
      authType: input.authType,
      credentialMask: input.credentialMask,
      encryptedCiphertext: input.encryptedCiphertext,
      credentialsCiphertext: input.encryptedCiphertext,
      encryptionIv: input.encryptionIv,
      credentialsIv: input.encryptionIv,
      encryptionAuthTag: input.encryptionAuthTag,
      credentialsTag: input.encryptionAuthTag,
      keyVersion: input.keyVersion,
      credentialsKeyVersion: input.keyVersion,
      validationStatus: 'VALID',
      validationErrorCode: null,
      lastValidatedAt: input.validatedAt,
      syncStatus: 'PENDING',
      lastSyncAt: null,
      nextSyncAt: null,
      connectionStatus: 'CONNECTED',
      disconnectedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await (cols.providerConnections as any).insertOne(doc);

      // Create initial sync run
      await (cols.providerSyncRuns as any).insertOne({
        id: randomUUID(),
        workspaceId,
        providerConnectionId: input.id,
        trigger: 'INITIAL',
        status: 'QUEUED',
        availableAt: now,
        claimedAt: null,
        leaseExpiresAt: null,
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        attemptNo: 1,
        idempotencyKey: initialIdempotencyKey(input.id),
        errorCode: null,
        itemsDiscovered: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsUnchanged: 0,
        itemsMissing: 0,
        createdAt: now,
      });

      return await this.mapSummary(doc, workspaceId);
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ProviderConnectionAlreadyExistsError();
      }
      throw new ProviderConnectionPersistenceError('Failed to create provider connection');
    }
  }

  async disconnect(
    workspaceId: string,
    id: string,
    now: Date,
  ): Promise<
    | {
        connectionStatus: any;
        disconnectedAt: Date;
        id: string;
      }
    | undefined
  > {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const updated = await (cols.providerConnections as any).findOneAndUpdate(
      {
        workspaceId,
        id,
        connectionStatus: 'CONNECTED',
      },
      {
        $set: {
          connectionStatus: 'DISCONNECTED',
          disconnectedAt: now,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );

    if (!updated) return undefined;

    return {
      id: updated.id,
      connectionStatus: 'DISCONNECTED',
      disconnectedAt: now,
    };
  }

  async replaceCredential(
    workspaceId: string,
    id: string,
    input: ReplaceCredentialInput,
  ): Promise<ProviderConnectionSummary | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const now = new Date();
    const updated = await (cols.providerConnections as any).findOneAndUpdate(
      { workspaceId, id },
      {
        $set: {
          credentialMask: input.credentialMask,
          encryptedCiphertext: input.encryptedCiphertext,
          credentialsCiphertext: input.encryptedCiphertext,
          encryptionIv: input.encryptionIv,
          credentialsIv: input.encryptionIv,
          encryptionAuthTag: input.encryptionAuthTag,
          credentialsTag: input.encryptionAuthTag,
          keyVersion: input.keyVersion,
          credentialsKeyVersion: input.keyVersion,
          lastValidatedAt: input.validatedAt,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );

    if (!updated) return undefined;
    return await this.mapSummary(updated, workspaceId);
  }

  async updateValidationResult(
    workspaceId: string,
    id: string,
    input: ValidationResultInput,
  ): Promise<ProviderConnectionSummary | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const now = new Date();
    const updated = await (cols.providerConnections as any).findOneAndUpdate(
      { workspaceId, id },
      {
        $set: {
          validationStatus: input.validationStatus,
          validationErrorCode: input.validationErrorCode,
          lastValidatedAt: input.validatedAt,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );

    if (!updated) return undefined;
    return await this.mapSummary(updated, workspaceId);
  }

  async findRunByIdempotencyKey(
    workspaceId: string,
    connectionId: string,
    internalIdempotencyKey: string,
  ): Promise<{ id: string } | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const run = await (cols.providerSyncRuns as any).findOne({
      workspaceId,
      providerConnectionId: connectionId,
      idempotencyKey: internalIdempotencyKey,
    });

    return run ? { id: run.id } : undefined;
  }

  async findActiveRun(
    workspaceId: string,
    connectionId: string,
  ): Promise<{ id: string } | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const run = await (cols.providerSyncRuns as any).findOne({
      workspaceId,
      providerConnectionId: connectionId,
      status: { $in: ['QUEUED', 'RUNNING'] },
    });

    return run ? { id: run.id } : undefined;
  }

  async createManualSyncRun(
    workspaceId: string,
    connectionId: string,
    internalIdempotencyKey: string,
    now: Date,
  ): Promise<{ id: string }> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const id = randomUUID();

    await (cols.providerSyncRuns as any).insertOne({
      id,
      workspaceId,
      providerConnectionId: connectionId,
      trigger: 'MANUAL',
      status: 'QUEUED',
      availableAt: now,
      claimedAt: null,
      leaseExpiresAt: null,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      attemptNo: 1,
      idempotencyKey: internalIdempotencyKey,
      errorCode: null,
      itemsDiscovered: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsUnchanged: 0,
      itemsMissing: 0,
      createdAt: now,
    });

    return { id };
  }

  async listSyncRuns(
    workspaceId: string,
    connectionId: string,
    limit: number,
  ): Promise<readonly ProviderSyncRunSummary[]> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const runs = await (cols.providerSyncRuns as any)
      .find({
        workspaceId,
        providerConnectionId: connectionId,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return runs.map((r: any) => ({
      id: ensureValidUuid(r.id),
      trigger: r.trigger,
      status: r.status,
      startedAt: r.startedAt ?? null,
      finishedAt: r.finishedAt ?? null,
      durationMs: r.durationMs ?? null,
      attemptNo: r.attemptNo ?? 1,
      errorCode: r.errorCode ?? null,
      itemsDiscovered: r.itemsDiscovered ?? 0,
      itemsCreated: r.itemsCreated ?? 0,
      itemsUpdated: r.itemsUpdated ?? 0,
      itemsUnchanged: r.itemsUnchanged ?? 0,
      itemsMissing: r.itemsMissing ?? 0,
      createdAt: r.createdAt,
    }));
  }
}
