import { alertEvents, alertRules, monitoringRuns, monitoringTargets } from '@domainpulse/database';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import type { DatabaseTransactionOperation } from '@domainpulse/database';

import {
  InvalidMonitoringCursorError,
  MonitoringPersistenceError,
} from './monitoring.errors';
import type {
  AlertRule,
  AlertEvent,
  AlertRuleKey,
  AlertSeverity,
  AlertsListQuery,
  CursorPosition,
  MonitoringDatabaseHost,
  MonitoringRun,
  MonitoringRunCreateInput,
  MonitoringRunsListQuery,
  MonitoringStore,
  MonitoringTarget,
  MonitoringTargetCreateInput,
  MonitoringTargetUpdateInput,
  Page,
} from './monitoring.types';

const DEFAULT_PAGE_LIMIT = 25;
const MAX_PAGE_LIMIT = 100;

/**
 * Safely retrieves an element from an array at a known-valid index.
 * The caller must ensure the index is within bounds.
 */
function getArrayElement<T>(array: readonly T[], index: number): T {
  const element = array[index];
  if (element === undefined) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- error message construction
    throw new Error(`Array index ${index} out of bounds for length ${array.length}`);
  }
  return element;
}

function encodeCursor(position: CursorPosition): string {
  return Buffer.from(
    JSON.stringify({ ...position, version: 1 }),
    'utf8',
  ).toString('base64url');
}

function decodeCursor(cursor: string | undefined): CursorPosition | undefined {
  if (cursor === undefined) {
    return undefined;
  }
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const payload = JSON.parse(decoded) as Record<string, unknown>;
    if (
      typeof payload.createdAt !== 'string' ||
      typeof payload.id !== 'string' ||
      payload.version !== 1
    ) {
      throw new InvalidMonitoringCursorError();
    }
    const canonical = Buffer.from(decoded, 'utf8').toString('base64url');
    if (canonical !== cursor) {
      throw new InvalidMonitoringCursorError();
    }
    return { createdAt: payload.createdAt, id: payload.id };
  } catch (error) {
    if (error instanceof InvalidMonitoringCursorError) {
      throw error;
    }
    throw new InvalidMonitoringCursorError();
  }
}

function mapTarget(row: typeof monitoringTargets.$inferSelect): MonitoringTarget {
  return {
    checkIntervalMinutes: row.checkIntervalMinutes,
    consecutiveFailures: row.consecutiveFailures,
    createdAt: row.createdAt,
    domainId: row.domainId,
    enabled: row.enabled,
    id: row.id,
    lastRunAt: row.lastRunAt,
    lastRunStatus: row.lastRunStatus,
    nextRunAt: row.nextRunAt,
    updatedAt: row.updatedAt,
    workspaceId: row.workspaceId,
  };
}

function mapRun(row: typeof monitoringRuns.$inferSelect): MonitoringRun {
  return {
    attemptNo: row.attemptNo,
    availableAt: row.availableAt,
    claimedAt: row.claimedAt,
    createdAt: row.createdAt,
    domainId: row.domainId,
    durationMs: row.durationMs,
    errorCode: row.errorCode,
    finishedAt: row.finishedAt,
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    leaseExpiresAt: row.leaseExpiresAt,
    runMetadata: row.runMetadata,
    sourcesAttempted: [...row.sourcesAttempted],
    sourcesSucceeded: [...row.sourcesSucceeded],
    startedAt: row.startedAt,
    status: row.status,
    targetId: row.targetId,
    trigger: row.trigger,
    workspaceId: row.workspaceId,
  };
}

function mapRule(row: typeof alertRules.$inferSelect): AlertRule {
  return {
    createdAt: row.createdAt,
    enabled: row.enabled,
    id: row.id,
    key: row.key,
    severity: row.severity,
    thresholdCount: row.thresholdCount,
    thresholdDays: row.thresholdDays,
    updatedAt: row.updatedAt,
    workspaceId: row.workspaceId,
  };
}

function mapEvent(row: typeof alertEvents.$inferSelect): AlertEvent {
  return {
    ackedAt: row.ackedAt,
    ackedByUserId: row.ackedByUserId,
    createdAt: row.createdAt,
    dedupeKey: row.dedupeKey,
    detail: row.detail,
    domainId: row.domainId,
    evidence: row.evidence,
    firstSeenAt: row.firstSeenAt,
    id: row.id,
    lastSeenAt: row.lastSeenAt,
    occurrenceCount: row.occurrenceCount,
    resolvedAt: row.resolvedAt,
    ruleId: row.ruleId,
    severity: row.severity,
    status: row.status,
    targetId: row.targetId,
    title: row.title,
    updatedAt: row.updatedAt,
    workspaceId: row.workspaceId,
  };
}

export class PostgresMonitoringRepository implements MonitoringStore {
  constructor(private readonly host: MonitoringDatabaseHost) {}

  async findTargetByDomainId(
    workspaceId: string,
    domainId: string,
  ): Promise<MonitoringTarget | undefined> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [row] = await transaction
        .select()
        .from(monitoringTargets)
        .where(
          and(
            eq(monitoringTargets.workspaceId, workspaceId),
            eq(monitoringTargets.domainId, domainId),
          ),
        )
        .limit(1);
      return row ? mapTarget(row) : undefined;
    });
  }

  private computeNextRunAt(now: Date, checkIntervalMinutes: number): Date {
    return new Date(now.getTime() + checkIntervalMinutes * 60_000);
  }

  async createTarget(
    workspaceId: string,
    input: MonitoringTargetCreateInput,
    now: Date,
  ): Promise<MonitoringTarget> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const enabled = input.enabled ?? true;
      const checkIntervalMinutes = input.checkIntervalMinutes ?? 1_440;
      const nextRunAt = enabled ? this.computeNextRunAt(now, checkIntervalMinutes) : null;
      const [row] = await transaction
        .insert(monitoringTargets)
        .values({
          workspaceId,
          domainId: input.domainId,
          enabled,
          checkIntervalMinutes,
          nextRunAt,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (row === undefined) {
        throw new MonitoringPersistenceError('Failed to create monitoring target');
      }
      return mapTarget(row);
    });
  }

  async updateTarget(
    workspaceId: string,
    targetId: string,
    input: MonitoringTargetUpdateInput,
    now: Date,
  ): Promise<MonitoringTarget | undefined> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(monitoringTargets)
        .where(
          and(
            eq(monitoringTargets.workspaceId, workspaceId),
            eq(monitoringTargets.id, targetId),
          ),
        )
        .limit(1);
      if (existing === undefined) {
        return undefined;
      }
      const nextEnabled = input.enabled ?? existing.enabled;
      const nextInterval = input.checkIntervalMinutes ?? existing.checkIntervalMinutes;
      let nextRunAt: Date | null | undefined = undefined;
      if (input.enabled !== undefined || input.checkIntervalMinutes !== undefined) {
        if (nextEnabled) {
          const shouldSchedule =
            existing.nextRunAt === null || input.enabled === true || input.checkIntervalMinutes !== undefined;
          if (shouldSchedule) {
            nextRunAt = this.computeNextRunAt(now, nextInterval);
          }
        } else {
          nextRunAt = null;
        }
      }
      const updateValues: {
        updatedAt: Date;
        enabled?: boolean;
        checkIntervalMinutes?: number;
        nextRunAt?: Date | null;
      } = { updatedAt: now };
      if (input.enabled !== undefined) {
        updateValues.enabled = input.enabled;
      }
      if (input.checkIntervalMinutes !== undefined) {
        updateValues.checkIntervalMinutes = input.checkIntervalMinutes;
      }
      if (nextRunAt !== undefined) {
        updateValues.nextRunAt = nextRunAt;
      }
      const [row] = await transaction
        .update(monitoringTargets)
        .set(updateValues)
        .where(
          and(
            eq(monitoringTargets.workspaceId, workspaceId),
            eq(monitoringTargets.id, targetId),
          ),
        )
        .returning();
      return row ? mapTarget(row) : undefined;
    });
  }

  async findRunByIdempotencyKey(
    workspaceId: string,
    targetId: string,
    idempotencyKey: string,
  ): Promise<MonitoringRun | undefined> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [row] = await transaction
        .select()
        .from(monitoringRuns)
        .where(
          and(
            eq(monitoringRuns.workspaceId, workspaceId),
            eq(monitoringRuns.targetId, targetId),
            eq(monitoringRuns.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      return row ? mapRun(row) : undefined;
    });
  }

  async createRun(
    workspaceId: string,
    input: MonitoringRunCreateInput,
    now: Date,
  ): Promise<MonitoringRun> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [row] = await transaction
        .insert(monitoringRuns)
        .values({
          domainId: input.domainId,
          targetId: input.targetId,
          trigger: input.trigger,
          idempotencyKey: input.idempotencyKey,
          runMetadata: input.runMetadata ?? {},
          workspaceId,
          availableAt: now,
          createdAt: now,
          attemptNo: 1,
          status: 'QUEUED',
        })
        .returning();
      if (row === undefined) {
        throw new MonitoringPersistenceError('Failed to create monitoring run');
      }
      return mapRun(row);
    });
  }

  async listRuns(
    workspaceId: string,
    domainId: string,
    query: MonitoringRunsListQuery,
  ): Promise<Page<MonitoringRun>> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const limit = Math.min(query.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
      const cursor = decodeCursor(query.cursor);
      const conditions = [
        eq(monitoringRuns.workspaceId, workspaceId),
        eq(monitoringRuns.domainId, domainId),
      ];
      if (query.status !== undefined) {
        conditions.push(eq(monitoringRuns.status, query.status));
      }
      if (query.trigger !== undefined) {
        conditions.push(eq(monitoringRuns.trigger, query.trigger));
      }
      const cursorCondition = cursor !== undefined
        ? or(
            lt(monitoringRuns.createdAt, new Date(cursor.createdAt)),
            and(
              eq(monitoringRuns.createdAt, new Date(cursor.createdAt)),
              lt(monitoringRuns.id, cursor.id),
            ),
          )
        : undefined;
      const rows = await transaction
        .select()
        .from(monitoringRuns)
        .where(and(...conditions, cursorCondition))
        .orderBy(desc(monitoringRuns.createdAt), desc(monitoringRuns.id))
        .limit(limit + 1);
      const items = rows.slice(0, limit).map(mapRun);
      let nextCursor: string | null = null;
      if (rows.length > limit) {
        const last = getArrayElement(rows, limit - 1);
        nextCursor = encodeCursor({
          createdAt: last.createdAt.toISOString(),
          id: last.id,
        });
      }
      return { items, nextCursor };
    });
  }

  async listAlerts(
    workspaceId: string,
    query: AlertsListQuery,
  ): Promise<Page<AlertEvent>> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const limit = Math.min(query.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
      const cursor = decodeCursor(query.cursor);
      const conditions = [eq(alertEvents.workspaceId, workspaceId)];
      if (query.status !== undefined) {
        conditions.push(eq(alertEvents.status, query.status));
      }
      if (query.severity !== undefined) {
        conditions.push(eq(alertEvents.severity, query.severity));
      }
      if (query.ruleKey !== undefined) {
        const [rule] = await transaction
          .select({ id: alertRules.id })
          .from(alertRules)
          .where(
            and(
              eq(alertRules.workspaceId, workspaceId),
              eq(alertRules.key, query.ruleKey),
            ),
          )
          .limit(1);
        if (rule) {
          conditions.push(eq(alertEvents.ruleId, rule.id));
        } else {
          return { items: [], nextCursor: null };
        }
      }
      if (query.domainId !== undefined) {
        conditions.push(eq(alertEvents.domainId, query.domainId));
      }
      const cursorCondition = cursor !== undefined
        ? or(
            lt(alertEvents.lastSeenAt, new Date(cursor.createdAt)),
            and(
              eq(alertEvents.lastSeenAt, new Date(cursor.createdAt)),
              lt(alertEvents.id, cursor.id),
            ),
          )
        : undefined;
      const rows = await transaction
        .select()
        .from(alertEvents)
        .where(and(...conditions, cursorCondition))
        .orderBy(desc(alertEvents.lastSeenAt), desc(alertEvents.id))
        .limit(limit + 1);
      const items = rows.slice(0, limit).map(mapEvent);
      let nextCursor: string | null = null;
      if (rows.length > limit) {
        const last = getArrayElement(rows, limit - 1);
        nextCursor = encodeCursor({
          createdAt: last.lastSeenAt.toISOString(),
          id: last.id,
        });
      }
      return { items, nextCursor };
    });
  }

  async findAlertById(
    workspaceId: string,
    alertId: string,
  ): Promise<AlertEvent | undefined> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [row] = await transaction
        .select()
        .from(alertEvents)
        .where(
          and(
            eq(alertEvents.workspaceId, workspaceId),
            eq(alertEvents.id, alertId),
          ),
        )
        .limit(1);
      return row ? mapEvent(row) : undefined;
    });
  }

  async acknowledgeAlert(
    workspaceId: string,
    alertId: string,
    userId: string,
    now: Date,
  ): Promise<AlertEvent | undefined> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [row] = await transaction
        .update(alertEvents)
        .set({
          status: 'ACKNOWLEDGED',
          ackedAt: now,
          ackedByUserId: userId,
          updatedAt: now,
        })
        .where(
          and(
            eq(alertEvents.workspaceId, workspaceId),
            eq(alertEvents.id, alertId),
            eq(alertEvents.status, 'OPEN'),
          ),
        )
        .returning();
      return row ? mapEvent(row) : undefined;
    });
  }

  async listAlertRules(workspaceId: string): Promise<readonly AlertRule[]> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const rows = await transaction
        .select()
        .from(alertRules)
        .where(eq(alertRules.workspaceId, workspaceId))
        .orderBy(alertRules.key);
      return rows.map(mapRule);
    });
  }

  async findAlertRuleByKey(
    workspaceId: string,
    key: AlertRuleKey,
  ): Promise<AlertRule | undefined> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [row] = await transaction
        .select()
        .from(alertRules)
        .where(
          and(
            eq(alertRules.workspaceId, workspaceId),
            eq(alertRules.key, key),
          ),
        )
        .limit(1);
      return row ? mapRule(row) : undefined;
    });
  }

  async upsertAlertRule(
    workspaceId: string,
    key: AlertRuleKey,
    input: MonitoringTargetUpdateInput & { severity?: AlertSeverity; thresholdDays?: number | null; thresholdCount?: number | null },
    now: Date,
  ): Promise<AlertRule> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const updateValues: {
        updatedAt: Date;
        enabled?: boolean;
        severity?: AlertSeverity;
        thresholdDays?: number | null;
        thresholdCount?: number | null;
      } = { updatedAt: now };
      if (input.enabled !== undefined) {
        updateValues.enabled = input.enabled;
      }
      if (input.severity !== undefined) {
        updateValues.severity = input.severity;
      }
      if (input.thresholdDays !== undefined) {
        updateValues.thresholdDays = input.thresholdDays;
      }
      if (input.thresholdCount !== undefined) {
        updateValues.thresholdCount = input.thresholdCount;
      }
      const [row] = await transaction
        .insert(alertRules)
        .values({
          workspaceId,
          key,
          enabled: input.enabled ?? true,
          severity: input.severity ?? 'INFO',
          thresholdDays: input.thresholdDays ?? null,
          thresholdCount: input.thresholdCount ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [alertRules.workspaceId, alertRules.key],
          set: updateValues,
        })
        .returning();
      if (row === undefined) {
        throw new MonitoringPersistenceError('Failed to upsert alert rule');
      }
      return mapRule(row);
    });
  }

  async withWorkspaceContext<T>(
    workspaceId: string,
    operation: DatabaseTransactionOperation<T>,
  ): Promise<T> {
    return this.host.withWorkspaceContext(workspaceId, operation);
  }
}