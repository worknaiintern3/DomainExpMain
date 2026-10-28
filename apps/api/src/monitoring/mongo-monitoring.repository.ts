import { randomUUID } from 'node:crypto';

import {
  MonitoringPersistenceError,
} from './monitoring.errors';
import type {
  AlertEvent,
  AlertRule,
  AlertRuleKey,
  AlertRuleUpdateInput,
  AlertsListQuery,
  MonitoringResultStatus,
  MonitoringRun,
  MonitoringRunCreateInput,
  MonitoringRunsListQuery,
  MonitoringStore,
  MonitoringTarget,
  MonitoringTargetCreateInput,
  MonitoringTargetUpdateInput,
  Page,
} from './monitoring.types';
import type { DatabaseService } from '../database/database.service';

export class MongoMonitoringRepository implements MonitoringStore {
  constructor(private readonly database: DatabaseService) {}

  async findDomain(
    workspaceId: string,
    domainId: string,
  ): Promise<{ inventoryState: string } | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new MonitoringPersistenceError('Database not initialized');

    const domain = await (cols.domains as any).findOne({
      workspaceId,
      id: domainId,
    });
    if (!domain) return undefined;

    return {
      inventoryState: domain.inventoryState,
    };
  }

  async findTargetByDomainId(
    workspaceId: string,
    domainId: string,
  ): Promise<MonitoringTarget | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new MonitoringPersistenceError('Database not initialized');

    const target = await cols.monitoringTargets.findOne({
      workspaceId,
      $or: [{ targetId: domainId }, { domainId: domainId }],
    } as any);
    if (!target) return undefined;

    return {
      id: target.id,
      workspaceId: target.workspaceId,
      domainId: (target as any).targetId ?? (target as any).domainId ?? domainId,
      enabled: target.enabled,
      checkIntervalMinutes: Math.round(((target as any).checkIntervalSeconds ?? 3600) / 60),
      nextRunAt: null,
      lastRunAt: (target as any).lastCheckedAt ?? null,
      lastRunStatus: ((target as any).status as MonitoringResultStatus) ?? null,
      consecutiveFailures: 0,
      createdAt: target.createdAt,
      updatedAt: target.updatedAt,
    };
  }

  async createTarget(
    workspaceId: string,
    input: MonitoringTargetCreateInput,
    now: Date,
  ): Promise<MonitoringTarget> {
    const cols = this.database.collections;
    if (!cols) throw new MonitoringPersistenceError('Database not initialized');

    const id = randomUUID();
    const doc = {
      id,
      workspaceId,
      targetType: 'DOMAIN',
      targetId: input.domainId,
      enabled: input.enabled ?? true,
      checkIntervalSeconds: (input.checkIntervalMinutes ?? 60) * 60,
      lastCheckedAt: null,
      status: 'HEALTHY',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await (cols.monitoringTargets as any).insertOne(doc);
      return {
        id,
        workspaceId,
        domainId: input.domainId,
        enabled: doc.enabled,
        checkIntervalMinutes: input.checkIntervalMinutes ?? 60,
        nextRunAt: null,
        lastRunAt: null,
        lastRunStatus: null,
        consecutiveFailures: 0,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new MonitoringPersistenceError('Monitoring target already exists for this domain');
      }
      throw new MonitoringPersistenceError('Failed to create monitoring target');
    }
  }

  async updateTarget(
    workspaceId: string,
    targetId: string,
    input: MonitoringTargetUpdateInput,
    now: Date,
  ): Promise<MonitoringTarget | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new MonitoringPersistenceError('Database not initialized');

    const updateSet: any = { updatedAt: now };
    if (input.enabled !== undefined) updateSet.enabled = input.enabled;
    if (input.checkIntervalMinutes !== undefined) {
      updateSet.checkIntervalSeconds = input.checkIntervalMinutes * 60;
    }

    const updated = await (cols.monitoringTargets as any).findOneAndUpdate(
      { workspaceId, id: targetId },
      { $set: updateSet },
      { returnDocument: 'after' },
    );

    if (!updated) return undefined;

    return {
      id: updated.id,
      workspaceId: updated.workspaceId,
      domainId: updated.targetId,
      enabled: updated.enabled,
      checkIntervalMinutes: Math.round((updated.checkIntervalSeconds ?? 3600) / 60),
      nextRunAt: null,
      lastRunAt: updated.lastCheckedAt ?? null,
      lastRunStatus: (updated.status as MonitoringResultStatus) ?? null,
      consecutiveFailures: 0,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async findRunByIdempotencyKey(
    workspaceId: string,
    targetId: string,
    idempotencyKey: string,
  ): Promise<MonitoringRun | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new MonitoringPersistenceError('Database not initialized');

    const run = await (cols.monitoringRuns as any).findOne({
      workspaceId,
      targetId,
      idempotencyKey,
    });
    if (!run) return undefined;

    return run as MonitoringRun;
  }

  async createRun(
    workspaceId: string,
    input: MonitoringRunCreateInput,
    now: Date,
  ): Promise<MonitoringRun> {
    const cols = this.database.collections;
    if (!cols) throw new MonitoringPersistenceError('Database not initialized');

    const id = randomUUID();
    const doc: MonitoringRun = {
      id,
      workspaceId,
      targetId: input.targetId,
      domainId: input.domainId,
      trigger: input.trigger,
      status: 'QUEUED',
      availableAt: now,
      claimedAt: null,
      leaseExpiresAt: null,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      attemptNo: 1,
      idempotencyKey: input.idempotencyKey,
      errorCode: null,
      sourcesAttempted: [],
      sourcesSucceeded: [],
      runMetadata: input.runMetadata ?? {},
      createdAt: now,
    };

    try {
      await (cols.monitoringRuns as any).insertOne(doc);
      return doc;
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new MonitoringPersistenceError('Monitoring run idempotency conflict');
      }
      throw new MonitoringPersistenceError('Failed to create monitoring run');
    }
  }

  async listRuns(
    workspaceId: string,
    domainId: string,
    query: MonitoringRunsListQuery,
  ): Promise<Page<MonitoringRun>> {
    const cols = this.database.collections;
    if (!cols) throw new MonitoringPersistenceError('Database not initialized');

    const limit = query.limit ?? 20;
    const filter: any = { workspaceId, domainId };
    if (query.status) filter.status = query.status;
    if (query.trigger) filter.trigger = query.trigger;

    const rows = await (cols.monitoringRuns as any)
      .find(filter)
      .sort({ createdAt: -1, id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;
    const last = items.at(-1);

    return {
      items,
      nextCursor: hasNext && last ? last.id : null,
    };
  }

  async listAlerts(
    workspaceId: string,
    query: AlertsListQuery,
  ): Promise<Page<AlertEvent>> {
    const cols = this.database.collections;
    if (!cols) throw new MonitoringPersistenceError('Database not initialized');

    const limit = query.limit ?? 20;
    const filter: any = { workspaceId };
    if (query.status) filter.status = query.status;
    if (query.severity) filter.severity = query.severity;
    if (query.domainId) filter.domainId = query.domainId;

    const rows = await (cols.alertEvents as any)
      .find(filter)
      .sort({ createdAt: -1, id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;
    const last = items.at(-1);

    return {
      items,
      nextCursor: hasNext && last ? last.id : null,
    };
  }

  async findAlertById(
    workspaceId: string,
    alertId: string,
  ): Promise<AlertEvent | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new MonitoringPersistenceError('Database not initialized');

    const alert = await (cols.alertEvents as any).findOne({
      workspaceId,
      id: alertId,
    });
    return alert ?? undefined;
  }

  async acknowledgeAlert(
    workspaceId: string,
    alertId: string,
    userId: string,
    now: Date,
  ): Promise<AlertEvent | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new MonitoringPersistenceError('Database not initialized');

    const updated = await (cols.alertEvents as any).findOneAndUpdate(
      { workspaceId, id: alertId },
      {
        $set: {
          status: 'ACKNOWLEDGED',
          ackedAt: now,
          ackedByUserId: userId,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );

    return updated ?? undefined;
  }

  async listAlertRules(workspaceId: string): Promise<readonly AlertRule[]> {
    const cols = this.database.collections;
    if (!cols) throw new MonitoringPersistenceError('Database not initialized');

    return await (cols.alertRules as any).find({ workspaceId }).toArray();
  }

  async findAlertRuleByKey(
    workspaceId: string,
    key: AlertRuleKey,
  ): Promise<AlertRule | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new MonitoringPersistenceError('Database not initialized');

    const rule = await (cols.alertRules as any).findOne({ workspaceId, key });
    return rule ?? undefined;
  }

  async upsertAlertRule(
    workspaceId: string,
    key: AlertRuleKey,
    input: AlertRuleUpdateInput,
    now: Date,
  ): Promise<AlertRule> {
    const cols = this.database.collections;
    if (!cols) throw new MonitoringPersistenceError('Database not initialized');

    const id = randomUUID();
    const updateSet: any = { updatedAt: now };
    if (input.enabled !== undefined) updateSet.enabled = input.enabled;
    if (input.severity !== undefined) updateSet.severity = input.severity;
    if (input.thresholdDays !== undefined) updateSet.thresholdDays = input.thresholdDays;
    if (input.thresholdCount !== undefined) updateSet.thresholdCount = input.thresholdCount;

    const doc = await (cols.alertRules as any).findOneAndUpdate(
      { workspaceId, key },
      {
        $set: updateSet,
        $setOnInsert: {
          id,
          workspaceId,
          key,
          enabled: input.enabled ?? true,
          severity: input.severity ?? 'WARNING',
          thresholdDays: input.thresholdDays ?? null,
          thresholdCount: input.thresholdCount ?? null,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    return doc as AlertRule;
  }

  async withWorkspaceContext<T>(
    _workspaceId: string,
    operation: any,
  ): Promise<T> {
    return operation(this.database);
  }
}
