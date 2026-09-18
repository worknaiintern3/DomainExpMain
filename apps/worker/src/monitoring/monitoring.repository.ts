import {
  domains,
  monitoringRuns,
  monitoringTargets,
  type DatabaseClient,
} from '@domainpulse/database';
import { and, eq, gt, sql } from 'drizzle-orm';

import { canRetry, retryDelayMs, retryIdempotencyKey } from './retry-policy';
import type {
  ClaimedMonitoringRun,
  MonitoringDomain,
  MonitoringExecutionResult,
  MonitoringQueueStore,
} from './monitoring.types';

interface ScheduledRow {
  readonly runId: string;
}

interface ClaimedRow {
  readonly attemptNo: number;
  readonly domainId: string;
  readonly idempotencyKey: string;
  readonly leaseExpiresAt: Date;
  readonly runId: string;
  readonly targetId: string;
  readonly workspaceId: string;
}

interface RecoveredRow {
  readonly runId: string;
}

interface RetentionRow {
  readonly deletedCount: number;
}

interface RuntimeRoleRow {
  readonly bypassRls: boolean;
  readonly ownsProtectedTable: boolean;
  readonly protectedTablesUseRls: boolean;
  readonly superuser: boolean;
}

export class UnsafeWorkerDatabaseRoleError extends Error {
  constructor() {
    super('Worker database role is not a safe non-owner NOBYPASSRLS role');
    this.name = 'UnsafeWorkerDatabaseRoleError';
  }
}

export class PostgresMonitoringRepository implements MonitoringQueueStore {
  constructor(private readonly client: DatabaseClient) {}

  async assertSafeRuntimeRole(): Promise<void> {
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
             and c.relname in (
               'domains',
               'monitoring_targets',
               'monitoring_runs',
               'domain_rdap_metadata',
               'domain_dns_metadata',
               'domain_tls_metadata'
             )
         ) as "ownsProtectedTable",
         (
           select count(*) = 6 and bool_and(c.relrowsecurity)
           from pg_catalog.pg_class c
           inner join pg_catalog.pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public'
             and c.relname in (
               'domains',
               'monitoring_targets',
               'monitoring_runs',
               'domain_rdap_metadata',
               'domain_dns_metadata',
               'domain_tls_metadata'
             )
         ) as "protectedTablesUseRls"
       from pg_catalog.pg_roles r
       where r.rolname = current_user`,
    );
    const role = result.rows[0];
    if (
      !role
      || role.superuser
      || role.bypassRls
      || role.ownsProtectedTable
      || !role.protectedTablesUseRls
    ) {
      throw new UnsafeWorkerDatabaseRoleError();
    }
  }

  async scheduleDue(now: Date, limit: number): Promise<number> {
    const result = await this.client.pool.query<ScheduledRow>(
      'select "run_id" as "runId" from domainpulse.schedule_due_monitoring_runs($1, $2)',
      [now, limit],
    );
    return result.rowCount ?? result.rows.length;
  }

  async claim(
    now: Date,
    limit: number,
    leaseMs: number,
  ): Promise<readonly ClaimedMonitoringRun[]> {
    const result = await this.client.pool.query<ClaimedRow>(
      `select
         "run_id" as "runId",
         "workspace_id" as "workspaceId",
         "target_id" as "targetId",
         "domain_id" as "domainId",
         "attempt_no" as "attemptNo",
         "idempotency_key" as "idempotencyKey",
         "lease_expires_at" as "leaseExpiresAt"
       from domainpulse.claim_monitoring_runs($1, $2, $3)`,
      [now, limit, leaseMs],
    );
    return result.rows;
  }

  async recoverExpired(
    now: Date,
    limit: number,
    maxRetries: number,
  ): Promise<number> {
    const result = await this.client.pool.query<RecoveredRow>(
      'select "run_id" as "runId" from domainpulse.reclaim_expired_monitoring_runs($1, $2, $3)',
      [now, limit, maxRetries],
    );
    return result.rowCount ?? result.rows.length;
  }

  async cleanupOldTerminalRuns(
    now: Date,
    retentionDays: number,
    batchSize: number,
  ): Promise<number> {
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.client.pool.query<RetentionRow>(
      `select domainpulse.cleanup_old_terminal_monitoring_runs($1, $2)
         as "deletedCount"`,
      [cutoff, batchSize],
    );
    return result.rows[0]?.deletedCount ?? 0;
  }

  async findDomain(
    run: ClaimedMonitoringRun,
  ): Promise<MonitoringDomain | undefined> {
    return await this.client.withWorkspaceContext(
      run.workspaceId,
      async (transaction) => {
        const [domain] = await transaction
          .select({ normalizedDomainName: domains.normalizedDomainName })
          .from(domains)
          .where(
            and(
              eq(domains.workspaceId, run.workspaceId),
              eq(domains.id, run.domainId),
              eq(domains.inventoryState, 'TRACKED'),
            ),
          )
          .limit(1);
        return domain;
      },
    );
  }

  async finalize(
    run: ClaimedMonitoringRun,
    result: MonitoringExecutionResult,
    maxRetries: number,
  ): Promise<boolean> {
    return await this.client.withWorkspaceContext(
      run.workspaceId,
      async (transaction) => {
        const [updatedRun] = await transaction
          .update(monitoringRuns)
          .set({
            durationMs: result.durationMs,
            errorCode: result.errorCode,
            finishedAt: result.finishedAt,
            leaseExpiresAt: null,
            sourcesAttempted: [...result.sourcesAttempted],
            sourcesSucceeded: [...result.sourcesSucceeded],
            status: result.status,
          })
          .where(
            and(
              eq(monitoringRuns.workspaceId, run.workspaceId),
              eq(monitoringRuns.id, run.runId),
              eq(monitoringRuns.status, 'RUNNING'),
              gt(monitoringRuns.leaseExpiresAt, result.finishedAt),
            ),
          )
          .returning({ id: monitoringRuns.id });
        if (!updatedRun) return false;

        await transaction
          .update(monitoringTargets)
          .set({
            consecutiveFailures:
              result.status === 'SUCCESS'
                ? 0
                : sql`${monitoringTargets.consecutiveFailures} + 1`,
            lastRunAt: result.finishedAt,
            lastRunStatus: result.status,
            updatedAt: result.finishedAt,
          })
          .where(
            and(
              eq(monitoringTargets.workspaceId, run.workspaceId),
              eq(monitoringTargets.id, run.targetId),
            ),
          );

        if (canRetry(run.attemptNo, maxRetries, result.retryable)) {
          const nextAttemptNo = run.attemptNo + 1;
          const delayMs = retryDelayMs(nextAttemptNo);
          if (delayMs !== undefined) {
            await transaction
              .insert(monitoringRuns)
              .values({
                attemptNo: nextAttemptNo,
                availableAt: new Date(result.finishedAt.getTime() + delayMs),
                domainId: run.domainId,
                idempotencyKey: retryIdempotencyKey(
                  run.idempotencyKey,
                  nextAttemptNo,
                ),
                runMetadata: { retryOfRunId: run.runId },
                targetId: run.targetId,
                trigger: 'RETRY',
                workspaceId: run.workspaceId,
              })
              .onConflictDoNothing({
                target: [
                  monitoringRuns.workspaceId,
                  monitoringRuns.targetId,
                  monitoringRuns.idempotencyKey,
                ],
              });
          }
        }
        return true;
      },
    );
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
