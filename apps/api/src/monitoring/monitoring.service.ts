import { createHash } from 'node:crypto';

import { domains } from '@domainpulse/database';
import { and, eq } from 'drizzle-orm';

import {
  AlertAcknowledgeForbiddenError,
  AlertNotFoundError,
  ArchivalDomainMonitoringError,
  DisabledTargetManualRunError,
  InvalidMonitoringInputError,
  MonitoringPersistenceError,
  MonitoringTargetNotFoundError,
  MonitoringWriteForbiddenError,
} from './monitoring.errors';
import type {
  AlertRuleKey,
  AlertRuleUpdateInput,
  AlertsListQuery,
  MonitoringRunsListQuery,
  MonitoringStore,
  MonitoringTarget,
  MonitoringTargetCreateInput,
  MonitoringTargetUpdateInput,
  Page,
} from './monitoring.types';

function requireMonitoringWriteAccess(principal: { role: string }): void {
  if (principal.role === 'member') {
    throw new MonitoringWriteForbiddenError();
  }
}

function deriveIdempotencyKey(targetId: string, userKey: string): string {
  return createHash('sha256')
    .update(`${targetId}:${userKey}`)
    .digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return code === '23505';
  }
  if (error instanceof Error) {
    return error.message.includes('23505') || error.message.includes('duplicate key');
  }
  return false;
}

export class MonitoringService {
  constructor(
    private readonly store: MonitoringStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getTarget(
    principal: { workspaceId: string; role: string },
    domainId: string,
  ): Promise<MonitoringTarget | { configured: false; domainId: string }> {
    const domain = await this.checkDomainEligibility(principal.workspaceId, domainId);
    if (domain === undefined) {
      throw new MonitoringTargetNotFoundError();
    }
    const target = await this.store.findTargetByDomainId(
      principal.workspaceId,
      domainId,
    );
    if (target === undefined) {
      return { configured: false, domainId };
    }
    return target;
  }

  async configureTarget(
    principal: { workspaceId: string; role: string },
    domainId: string,
    input: MonitoringTargetUpdateInput,
  ): Promise<MonitoringTarget> {
    requireMonitoringWriteAccess(principal);

    const domain = await this.checkDomainEligibility(
      principal.workspaceId,
      domainId,
    );
    if (domain === undefined) {
      throw new MonitoringTargetNotFoundError();
    }
    if (domain.inventoryState === 'ARCHIVED' && input.enabled === true) {
      throw new ArchivalDomainMonitoringError();
    }

    let target = await this.store.findTargetByDomainId(
      principal.workspaceId,
      domainId,
    );
    if (target === undefined) {
      const createInput: MonitoringTargetCreateInput = { domainId };
      if (input.enabled !== undefined) {
        createInput.enabled = input.enabled;
      }
      if (input.checkIntervalMinutes !== undefined) {
        createInput.checkIntervalMinutes = input.checkIntervalMinutes;
      }
      target = await this.store.createTarget(principal.workspaceId, createInput, this.now());
    } else {
      const updated = await this.store.updateTarget(
        principal.workspaceId,
        target.id,
        input,
        this.now(),
      );
      if (updated === undefined) {
        throw new MonitoringPersistenceError('Failed to update monitoring target');
      }
      target = updated;
    }

    return target;
  }

  private async checkDomainEligibility(
    workspaceId: string,
    domainId: string,
  ): Promise<{ inventoryState: string } | undefined> {
    return this.store.withWorkspaceContext(workspaceId, async (transaction) => {
      const [domain] = await transaction
        .select({ inventoryState: domains.inventoryState })
        .from(domains)
        .where(
          and(
            eq(domains.workspaceId, workspaceId),
            eq(domains.id, domainId),
          ),
        )
        .limit(1);
      return domain;
    });
  }

  async listRuns(
    principal: { workspaceId: string },
    domainId: string,
    query: MonitoringRunsListQuery,
  ): Promise<Page<unknown>> {
    const domain = await this.checkDomainEligibility(principal.workspaceId, domainId);
    if (domain === undefined) {
      throw new MonitoringTargetNotFoundError();
    }
    const target = await this.store.findTargetByDomainId(
      principal.workspaceId,
      domainId,
    );
    if (target === undefined) {
      return { items: [], nextCursor: null };
    }
    return this.store.listRuns(principal.workspaceId, domainId, query);
  }

  async enqueueManualRun(
    principal: { workspaceId: string; role: string; userId: string },
    domainId: string,
    userIdempotencyKey: string,
  ): Promise<{ id: string; status: 'QUEUED'; trigger: 'MANUAL'; message: string }> {
    requireMonitoringWriteAccess(principal);

    const domain = await this.checkDomainEligibility(principal.workspaceId, domainId);
    if (domain === undefined) {
      throw new MonitoringTargetNotFoundError();
    }
    if (domain.inventoryState === 'ARCHIVED') {
      throw new DisabledTargetManualRunError();
    }

    const target = await this.store.findTargetByDomainId(
      principal.workspaceId,
      domainId,
    );
    if (target === undefined) {
      throw new MonitoringTargetNotFoundError();
    }
    if (!target.enabled) {
      throw new DisabledTargetManualRunError();
    }

    const internalIdempotencyKey = deriveIdempotencyKey(
      target.id,
      userIdempotencyKey,
    );

    const existing = await this.store.findRunByIdempotencyKey(
      principal.workspaceId,
      target.id,
      internalIdempotencyKey,
    );
    if (existing !== undefined) {
      return {
        id: existing.id,
        status: 'QUEUED',
        trigger: 'MANUAL',
        message: 'Monitoring run already queued for this idempotency key',
      };
    }

    try {
      const run = await this.store.createRun(principal.workspaceId, {
        domainId,
        targetId: target.id,
        trigger: 'MANUAL',
        idempotencyKey: internalIdempotencyKey,
        runMetadata: {},
      }, this.now());

      return {
        id: run.id,
        status: 'QUEUED',
        trigger: 'MANUAL',
        message: 'Monitoring run queued successfully',
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const concurrent = await this.store.findRunByIdempotencyKey(
          principal.workspaceId,
          target.id,
          internalIdempotencyKey,
        );
        if (concurrent !== undefined) {
          return {
            id: concurrent.id,
            status: 'QUEUED',
            trigger: 'MANUAL',
            message: 'Monitoring run already queued for this idempotency key',
          };
        }
      }
      throw error;
    }
  }

  async listAlerts(
    principal: { workspaceId: string },
    query: AlertsListQuery,
  ): Promise<Page<unknown>> {
    return this.store.listAlerts(principal.workspaceId, query);
  }

  async acknowledgeAlert(
    principal: { workspaceId: string; role: string; userId: string },
    alertId: string,
  ): Promise<{ id: string; status: 'ACKNOWLEDGED'; acknowledgedAt: Date; acknowledgedByUserId: string }> {
    requireMonitoringWriteAccess(principal);

    const alert = await this.store.findAlertById(principal.workspaceId, alertId);
    if (alert === undefined) {
      throw new AlertNotFoundError();
    }
    if (alert.status !== 'OPEN') {
      if (alert.status === 'ACKNOWLEDGED') {
        if (alert.ackedAt === null || alert.ackedByUserId === null) {
          throw new MonitoringPersistenceError('Alert acknowledgement is incomplete');
        }
        return {
          id: alert.id,
          status: 'ACKNOWLEDGED',
          acknowledgedAt: alert.ackedAt,
          acknowledgedByUserId: alert.ackedByUserId,
        };
      }
      throw new AlertAcknowledgeForbiddenError();
    }

    const acknowledged = await this.store.acknowledgeAlert(
      principal.workspaceId,
      alertId,
      principal.userId,
      this.now(),
    );
    if (acknowledged === undefined) {
      const refreshed = await this.store.findAlertById(principal.workspaceId, alertId);
      if (refreshed?.status === 'ACKNOWLEDGED') {
        if (refreshed.ackedAt === null || refreshed.ackedByUserId === null) {
          throw new MonitoringPersistenceError('Alert acknowledgement is incomplete');
        }
        return {
          id: refreshed.id,
          status: 'ACKNOWLEDGED',
          acknowledgedAt: refreshed.ackedAt,
          acknowledgedByUserId: refreshed.ackedByUserId,
        };
      }
      if (refreshed?.status === 'RESOLVED') {
        throw new AlertAcknowledgeForbiddenError();
      }
      throw new MonitoringPersistenceError('Failed to acknowledge alert');
    }

    if (acknowledged.ackedAt === null || acknowledged.ackedByUserId === null) {
      throw new MonitoringPersistenceError('Alert acknowledgement is incomplete');
    }

    return {
      id: acknowledged.id,
      status: 'ACKNOWLEDGED',
      acknowledgedAt: acknowledged.ackedAt,
      acknowledgedByUserId: acknowledged.ackedByUserId,
    };
  }

  async listAlertRules(
    principal: { workspaceId: string },
  ): Promise<readonly unknown[]> {
    return this.store.listAlertRules(principal.workspaceId);
  }

  async updateAlertRule(
    principal: { workspaceId: string; role: string },
    key: AlertRuleKey,
    input: AlertRuleUpdateInput,
  ): Promise<unknown> {
    requireMonitoringWriteAccess(principal);

    const usesDays = key.includes('_EXPIRY_');
    const usesCount = key === 'RETRIEVAL_FAILURE_REPEATED';

    if (usesDays) {
      if (input.thresholdDays !== undefined) {
        if (input.thresholdDays === null) {
          throw new InvalidMonitoringInputError(`${key} requires thresholdDays`);
        }
        if (input.thresholdDays < 0) {
          throw new InvalidMonitoringInputError('thresholdDays must be non-negative');
        }
      }
      if (input.thresholdCount !== undefined && input.thresholdCount !== null) {
        throw new InvalidMonitoringInputError(`${key} must not have thresholdCount`);
      }
    } else if (usesCount) {
      if (input.thresholdCount !== undefined) {
        if (input.thresholdCount === null) {
          throw new InvalidMonitoringInputError(`${key} requires thresholdCount`);
        }
        if (input.thresholdCount < 1) {
          throw new InvalidMonitoringInputError('thresholdCount must be positive');
        }
      }
      if (input.thresholdDays !== undefined && input.thresholdDays !== null) {
        throw new InvalidMonitoringInputError(`${key} must not have thresholdDays`);
      }
    } else {
      if (input.thresholdDays !== undefined && input.thresholdDays !== null) {
        throw new InvalidMonitoringInputError(`${key} must not have thresholdDays`);
      }
      if (input.thresholdCount !== undefined && input.thresholdCount !== null) {
        throw new InvalidMonitoringInputError(`${key} must not have thresholdCount`);
      }
    }

    const existing = await this.store.findAlertRuleByKey(principal.workspaceId, key);
    if (existing === undefined) {
      if (usesDays && input.thresholdDays === undefined) {
        throw new InvalidMonitoringInputError(`${key} requires thresholdDays`);
      }
      if (usesCount && input.thresholdCount === undefined) {
        throw new InvalidMonitoringInputError(`${key} requires thresholdCount`);
      }
    }

    const rule = await this.store.upsertAlertRule(
      principal.workspaceId,
      key,
      input,
      this.now(),
    );
    return rule;
  }
}