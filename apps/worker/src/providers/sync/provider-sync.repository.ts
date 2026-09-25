import {
  providerAccounts,
  providerConnections,
  providerSyncRuns,
  type DatabaseClient,
} from '@domainpulse/database';
import { and, eq, gt } from 'drizzle-orm';

import type {
  ClaimedProviderSyncRun,
  ProviderConnectionForSync,
  ProviderSyncExecutionResult,
  ProviderSyncQueueStore,
} from './provider-sync.types';

interface ScheduledRow {
  readonly runId: string;
}

interface ClaimedRow {
  readonly attemptNo: number;
  readonly connectionId: string;
  readonly idempotencyKey: string;
  readonly leaseExpiresAt: Date;
  readonly runId: string;
  readonly workspaceId: string;
}

interface RecoveredRow {
  readonly runId: string;
}

interface RuntimeRoleRow {
  readonly bypassRls: boolean;
  readonly ownsProtectedTable: boolean;
  readonly protectedTablesUseRls: boolean;
  readonly superuser: boolean;
}

const PROTECTED_TABLES = ['provider_connections', 'provider_sync_runs', 'provider_resource_links'];

export class UnsafeProviderSyncWorkerRoleError extends Error {
  constructor() {
    super('Provider sync worker database role is not a safe non-owner NOBYPASSRLS role');
    this.name = 'UnsafeProviderSyncWorkerRoleError';
  }
}

/** Bounded, sanitized detail paired with each canonical error code. Never the raw upstream message. */
function sanitizedErrorDetail(code: string): string {
  return `Provider sync failed: ${code}`;
}

function connectionSyncStatusFor(status: ProviderSyncExecutionResult['status']): 'SUCCESS' | 'FAILED' {
  return status === 'FAILED' ? 'FAILED' : 'SUCCESS';
}

export class PostgresProviderSyncRepository implements ProviderSyncQueueStore {
  constructor(private readonly client: DatabaseClient) {}

  async assertSafeRuntimeRole(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      return;
    }
    const result = await this.client.pool.query<RuntimeRoleRow>(
      `select
         r.rolsuper as "superuser",
         r.rolbypassrls as "bypassRls",
         exists (
           select 1
           from pg_catalog.pg_class c
           inner join pg_catalog.pg_namespace n on n.oid = c.relnamespace
           where c.relowner = r.oid
             and n.nspname = 'public'
             and c.relname in (${PROTECTED_TABLES.map((_, index) => `$${String(index + 1)}`).join(', ')})
         ) as "ownsProtectedTable",
         (
           select count(*) = ${String(PROTECTED_TABLES.length)} and bool_and(c.relrowsecurity)
           from pg_catalog.pg_class c
           inner join pg_catalog.pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public'
             and c.relname in (${PROTECTED_TABLES.map((_, index) => `$${String(index + 1)}`).join(', ')})
         ) as "protectedTablesUseRls"
       from pg_catalog.pg_roles r
       where r.rolname = current_user`,
      PROTECTED_TABLES,
    );
    const role = result.rows[0];
    if (
      !role
      || role.superuser
      || role.bypassRls
      || role.ownsProtectedTable
      || !role.protectedTablesUseRls
    ) {
      throw new UnsafeProviderSyncWorkerRoleError();
    }
  }

  async scheduleDue(now: Date, limit: number): Promise<number> {
    const result = await this.client.pool.query<ScheduledRow>(
      'select "run_id" as "runId" from domainpulse.schedule_due_provider_sync_runs($1, $2)',
      [now, limit],
    );
    return result.rowCount ?? result.rows.length;
  }

  async claim(
    now: Date,
    limit: number,
    leaseMs: number,
  ): Promise<readonly ClaimedProviderSyncRun[]> {
    const result = await this.client.pool.query<ClaimedRow>(
      `select
         "run_id" as "runId",
         "workspace_id" as "workspaceId",
         "connection_id" as "connectionId",
         "attempt_no" as "attemptNo",
         "idempotency_key" as "idempotencyKey",
         "lease_expires_at" as "leaseExpiresAt"
       from domainpulse.claim_provider_sync_runs($1, $2, $3)`,
      [now, limit, leaseMs],
    );
    return result.rows;
  }

  async recoverExpired(now: Date, limit: number, maxRetries: number): Promise<number> {
    const result = await this.client.pool.query<RecoveredRow>(
      'select "run_id" as "runId" from domainpulse.reclaim_expired_provider_sync_runs($1, $2, $3)',
      [now, limit, maxRetries],
    );
    return result.rowCount ?? result.rows.length;
  }

  async loadConnectionForSync(
    workspaceId: string,
    connectionId: string,
  ): Promise<ProviderConnectionForSync | undefined> {
    return await this.client.withWorkspaceContext(workspaceId, async (transaction) => {
      const [row] = await transaction
        .select({
          connectionStatus: providerConnections.connectionStatus,
          encryptedCiphertext: providerConnections.encryptedCiphertext,
          encryptionAuthTag: providerConnections.encryptionAuthTag,
          encryptionIv: providerConnections.encryptionIv,
          id: providerConnections.id,
          keyVersion: providerConnections.keyVersion,
          providerKey: providerAccounts.providerKey,
        })
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
            eq(providerConnections.id, connectionId),
          ),
        )
        .limit(1);
      return row ? { ...row, workspaceId } : undefined;
    });
  }

  async finalize(
    run: ClaimedProviderSyncRun,
    result: ProviderSyncExecutionResult,
  ): Promise<boolean> {
    return await this.client.withWorkspaceContext(run.workspaceId, async (transaction) => {
      const [updatedRun] = await transaction
        .update(providerSyncRuns)
        .set({
          durationMs: result.durationMs,
          errorCode: result.errorCode,
          errorDetail: result.errorCode ? sanitizedErrorDetail(result.errorCode) : null,
          finishedAt: result.finishedAt,
          itemsCreated: result.itemsCreated,
          itemsDiscovered: result.itemsDiscovered,
          itemsMissing: result.itemsMissing,
          itemsUnchanged: result.itemsUnchanged,
          itemsUpdated: result.itemsUpdated,
          leaseExpiresAt: null,
          status: result.status,
        })
        .where(
          and(
            eq(providerSyncRuns.workspaceId, run.workspaceId),
            eq(providerSyncRuns.id, run.runId),
            eq(providerSyncRuns.status, 'RUNNING'),
            gt(providerSyncRuns.leaseExpiresAt, result.finishedAt),
          ),
        )
        .returning({ id: providerSyncRuns.id });
      if (!updatedRun) return false;

      // Truthful, bounded connection-level status; never touches next_sync_at
      // (only the Phase 10C scheduler function advances that cadence).
      await transaction
        .update(providerConnections)
        .set({
          lastSyncAt: result.finishedAt,
          syncStatus: connectionSyncStatusFor(result.status),
          updatedAt: result.finishedAt,
        })
        .where(
          and(
            eq(providerConnections.workspaceId, run.workspaceId),
            eq(providerConnections.id, run.connectionId),
          ),
        );

      return true;
    });
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
