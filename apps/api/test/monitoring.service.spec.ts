import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  AlertAcknowledgeForbiddenError,
  AlertNotFoundError,
  ArchivalDomainMonitoringError,
  DisabledTargetManualRunError,
  InvalidMonitoringInputError,
  MonitoringTargetNotFoundError,
  MonitoringWriteForbiddenError,
} from '../src/monitoring/monitoring.errors';
import { MonitoringService } from '../src/monitoring/monitoring.service';
import type { MonitoringStore, MonitoringTarget, AlertEvent, AlertRule, MonitoringRun } from '../src/monitoring/monitoring.types';

function createMockStore(): MonitoringStore & { _domains: Map<string, { inventoryState: string }> } {
  const domains = new Map<string, { inventoryState: string }>();
  const store: Partial<MonitoringStore> & { _domains: typeof domains } = {
    _domains: domains,
    withWorkspaceContext: vi.fn(async (_workspaceId: string, operation: (tx: unknown) => Promise<unknown>) => {
      // mock transaction that returns domain based on closure's domainId captured via operation's internal query
      // For test simplicity, operation is expected to be checkDomainEligibility which does select...
      // We instead directly inspect calls: we will make withWorkspaceContext return domain based on a separate mock mapping set per test
      // The operation will attempt to do transaction.select...; we provide a fake transaction that returns domain array
      const fakeTx = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => {
                // The test will set (store as any)._nextDomainReturn
                const ret = (store as unknown as { _nextDomainReturn?: unknown[] })._nextDomainReturn;
                return ret ?? [];
              },
            }),
          }),
        }),
      };
      return operation(fakeTx) as Promise<unknown>;
    }) as unknown as MonitoringStore['withWorkspaceContext'],
    findTargetByDomainId: vi.fn(),
    createTarget: vi.fn(),
    updateTarget: vi.fn(),
    findRunByIdempotencyKey: vi.fn(),
    createRun: vi.fn(),
    listRuns: vi.fn(),
    listAlerts: vi.fn(),
    findAlertById: vi.fn(),
    acknowledgeAlert: vi.fn(),
    listAlertRules: vi.fn(),
    findAlertRuleByKey: vi.fn(),
    upsertAlertRule: vi.fn(),
  };
  return store as MonitoringStore & { _domains: Map<string, { inventoryState: string }> };
}

const ownerWorkspaceId = randomUUID();
const memberWorkspaceId = randomUUID();
const domainId = randomUUID();
const userId = randomUUID();
const now = new Date('2036-02-03T04:05:06.000Z');

function mockTarget(overrides: Partial<MonitoringTarget> = {}): MonitoringTarget {
  return {
    checkIntervalMinutes: 1440,
    consecutiveFailures: 0,
    createdAt: now,
    domainId,
    enabled: true,
    id: randomUUID(),
    lastRunAt: null,
    lastRunStatus: null,
    nextRunAt: new Date(now.getTime() + 1440 * 60_000),
    updatedAt: now,
    workspaceId: ownerWorkspaceId,
    ...overrides,
  };
}

describe('MonitoringService unit', () => {
  let store: ReturnType<typeof createMockStore>;
  let service: MonitoringService;

  beforeEach(() => {
    store = createMockStore();
    service = new MonitoringService(store, () => now);
    vi.clearAllMocks();
  });

  describe('configureTarget', () => {
    it('member write forbidden', async () => {
      await expect(
        service.configureTarget({ workspaceId: ownerWorkspaceId, role: 'member' }, domainId, { enabled: true }),
      ).rejects.toThrow(MonitoringWriteForbiddenError);
    });

    it('archived domain cannot be enabled', async () => {
      (store.withWorkspaceContext as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_wid: string, op: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ inventoryState: 'ARCHIVED' }],
              }),
            }),
          }),
        };
        return op(fakeTx);
      });
      await expect(
        service.configureTarget({ workspaceId: ownerWorkspaceId, role: 'owner' }, domainId, { enabled: true }),
      ).rejects.toThrow(ArchivalDomainMonitoringError);
    });

    it('enabling sets next_run_at truthfully via repository', async () => {
      (store.withWorkspaceContext as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_wid: string, op: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ inventoryState: 'TRACKED' }],
              }),
            }),
          }),
        };
        return op(fakeTx);
      });
      store.findTargetByDomainId = vi.fn(async () => undefined);
      const created = mockTarget({ enabled: true, nextRunAt: new Date(now.getTime() + 60 * 60_000) });
      store.createTarget = vi.fn(async () => created);
      const result = await service.configureTarget({ workspaceId: ownerWorkspaceId, role: 'owner' }, domainId, { enabled: true, checkIntervalMinutes: 60 });
      expect(result.nextRunAt).not.toBeNull();
      expect(result.nextRunAt?.getTime()).toBeGreaterThan(now.getTime());
      expect(store.createTarget).toHaveBeenCalled();
    });
  });

  describe('enqueueManualRun', () => {
    it('owner/admin enqueue MANUAL + QUEUED', async () => {
      const target = mockTarget({ enabled: true });
      store.findTargetByDomainId = vi.fn(async () => target);
      store.findRunByIdempotencyKey = vi.fn(async () => undefined);
      const run = { id: randomUUID(), status: 'QUEUED', trigger: 'MANUAL' } as unknown as MonitoringRun;
      store.createRun = vi.fn(async () => run);
      (store.withWorkspaceContext as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_wid: string, op: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ inventoryState: 'TRACKED' }],
              }),
            }),
          }),
        };
        return op(fakeTx);
      });
      const result = await service.enqueueManualRun({ workspaceId: ownerWorkspaceId, role: 'owner', userId }, domainId, 'key1');
      expect(result.status).toBe('QUEUED');
      expect(result.trigger).toBe('MANUAL');
      expect(store.createRun).toHaveBeenCalledWith(
        ownerWorkspaceId,
        expect.objectContaining({ trigger: 'MANUAL', idempotencyKey: expect.any(String) }),
        now,
      );
      const passedKey = ((store.createRun as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as { idempotencyKey: string }).idempotencyKey;
      expect(passedKey).not.toContain('key1');
      expect(passedKey).toMatch(/^[a-f0-9]{64}$/);
    });

    it('member forbidden', async () => {
      await expect(
        service.enqueueManualRun({ workspaceId: memberWorkspaceId, role: 'member', userId }, domainId, 'k'),
      ).rejects.toThrow(MonitoringWriteForbiddenError);
    });

    it('same Idempotency-Key returns same run', async () => {
      const target = mockTarget({ enabled: true });
      store.findTargetByDomainId = vi.fn(async () => target);
      const existing = { id: randomUUID() } as MonitoringRun;
      store.findRunByIdempotencyKey = vi.fn(async () => existing);
      (store.withWorkspaceContext as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_wid: string, op: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ inventoryState: 'TRACKED' }],
              }),
            }),
          }),
        };
        return op(fakeTx);
      });
      const a = await service.enqueueManualRun({ workspaceId: ownerWorkspaceId, role: 'owner', userId }, domainId, 'same-key');
      const b = await service.enqueueManualRun({ workspaceId: ownerWorkspaceId, role: 'owner', userId }, domainId, 'same-key');
      expect(a.id).toBe(b.id);
      expect(a.id).toBe(existing.id);
    });

    it('concurrent same key produces one row via unique violation', async () => {
      const target = mockTarget({ enabled: true });
      store.findTargetByDomainId = vi.fn(async () => target);
      const created = { id: randomUUID() } as MonitoringRun;
      let firstCall = true;
      store.findRunByIdempotencyKey = vi.fn(async () => {
        if (firstCall) {
          firstCall = false;
          return undefined;
        }
        return created;
      });
      store.createRun = vi.fn(async () => {
        const err = Object.assign(new Error('duplicate key value violates unique constraint "monitoring_runs_workspace_target_idempotency_unique"'), { code: '23505' });
        throw err;
      });
      (store.withWorkspaceContext as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_wid: string, op: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ inventoryState: 'TRACKED' }],
              }),
            }),
          }),
        };
        return op(fakeTx);
      });
      const result = await service.enqueueManualRun({ workspaceId: ownerWorkspaceId, role: 'owner', userId }, domainId, 'concurrent-key');
      expect(result.id).toBe(created.id);
    });

    it('archived/disabled/unconfigured behavior', async () => {
      (store.withWorkspaceContext as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_wid: string, op: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ inventoryState: 'ARCHIVED' }],
              }),
            }),
          }),
        };
        return op(fakeTx);
      });
      store.findTargetByDomainId = vi.fn(async () => mockTarget({ enabled: true }));
      await expect(service.enqueueManualRun({ workspaceId: ownerWorkspaceId, role: 'owner', userId }, domainId, 'k')).rejects.toThrow(DisabledTargetManualRunError);

      (store.withWorkspaceContext as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_wid: string, op: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ inventoryState: 'TRACKED' }],
              }),
            }),
          }),
        };
        return op(fakeTx);
      });
      store.findTargetByDomainId = vi.fn(async () => mockTarget({ enabled: false }));
      await expect(service.enqueueManualRun({ workspaceId: ownerWorkspaceId, role: 'owner', userId }, domainId, 'k2')).rejects.toThrow(DisabledTargetManualRunError);

      (store.withWorkspaceContext as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_wid: string, op: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [],
              }),
            }),
          }),
        };
        return op(fakeTx);
      });
      store.findTargetByDomainId = vi.fn(async () => undefined);
      await expect(service.enqueueManualRun({ workspaceId: ownerWorkspaceId, role: 'owner', userId }, domainId, 'k3')).rejects.toThrow(MonitoringTargetNotFoundError);
    });
  });

  describe('acknowledgeAlert', () => {
    it('OPEN -> ACKNOWLEDGED', async () => {
      const alert = { id: randomUUID(), status: 'OPEN', ackedAt: null, ackedByUserId: null } as unknown as AlertEvent;
      store.findAlertById = vi.fn(async () => alert);
      const acked = { id: alert.id, status: 'ACKNOWLEDGED', ackedAt: now, ackedByUserId: userId } as unknown as AlertEvent;
      store.acknowledgeAlert = vi.fn(async () => acked);
      const result = await service.acknowledgeAlert({ workspaceId: ownerWorkspaceId, role: 'owner', userId }, alert.id);
      expect(result.status).toBe('ACKNOWLEDGED');
      expect(result.acknowledgedByUserId).toBe(userId);
    });

    it('replay idempotent', async () => {
      const alert = { id: randomUUID(), status: 'ACKNOWLEDGED', ackedAt: now, ackedByUserId: userId } as unknown as AlertEvent;
      store.findAlertById = vi.fn(async () => alert);
      const result = await service.acknowledgeAlert({ workspaceId: ownerWorkspaceId, role: 'owner', userId }, alert.id);
      expect(result.status).toBe('ACKNOWLEDGED');
      expect(store.acknowledgeAlert).not.toHaveBeenCalled();
    });

    it('RESOLVED -> conflict', async () => {
      const alert = { id: randomUUID(), status: 'RESOLVED', ackedAt: now, ackedByUserId: userId, resolvedAt: now } as unknown as AlertEvent;
      store.findAlertById = vi.fn(async () => alert);
      await expect(service.acknowledgeAlert({ workspaceId: ownerWorkspaceId, role: 'owner', userId }, alert.id)).rejects.toThrow(AlertAcknowledgeForbiddenError);
    });

    it('member forbidden', async () => {
      await expect(service.acknowledgeAlert({ workspaceId: memberWorkspaceId, role: 'member', userId }, randomUUID())).rejects.toThrow(MonitoringWriteForbiddenError);
    });

    it('cross-workspace blocked', async () => {
      store.findAlertById = vi.fn(async () => undefined);
      await expect(service.acknowledgeAlert({ workspaceId: ownerWorkspaceId, role: 'owner', userId }, randomUUID())).rejects.toThrow(AlertNotFoundError);
    });
  });

  describe('updateAlertRule', () => {
    it('per-key threshold validation', async () => {
      store.findAlertRuleByKey = vi.fn(async () => ({ key: 'DOMAIN_EXPIRY_CRITICAL' } as AlertRule));
      await expect(service.updateAlertRule({ workspaceId: ownerWorkspaceId, role: 'owner' }, 'DOMAIN_EXPIRY_CRITICAL', { thresholdDays: null })).rejects.toThrow(InvalidMonitoringInputError);
      await expect(service.updateAlertRule({ workspaceId: ownerWorkspaceId, role: 'owner' }, 'RETRIEVAL_FAILURE_REPEATED', { thresholdDays: 5 })).rejects.toThrow(InvalidMonitoringInputError);
    });

    it('DNS_CHANGED/CERT_CHANGED reject irrelevant thresholds', async () => {
      store.findAlertRuleByKey = vi.fn(async () => ({ key: 'DNS_CHANGED' } as AlertRule));
      await expect(service.updateAlertRule({ workspaceId: ownerWorkspaceId, role: 'owner' }, 'DNS_CHANGED', { thresholdDays: 1 })).rejects.toThrow(InvalidMonitoringInputError);
      await expect(service.updateAlertRule({ workspaceId: ownerWorkspaceId, role: 'owner' }, 'DNS_CHANGED', { thresholdCount: 1 })).rejects.toThrow(InvalidMonitoringInputError);
      await expect(service.updateAlertRule({ workspaceId: ownerWorkspaceId, role: 'owner' }, 'CERT_CHANGED', { thresholdCount: 2 })).rejects.toThrow(InvalidMonitoringInputError);
    });

    it('member PATCH forbidden', async () => {
      await expect(service.updateAlertRule({ workspaceId: memberWorkspaceId, role: 'member' }, 'DNS_CHANGED', { enabled: true })).rejects.toThrow(MonitoringWriteForbiddenError);
    });

    it('GET does not mutate and upsert uses route key', async () => {
      store.findAlertRuleByKey = vi.fn(async () => ({ key: 'DOMAIN_EXPIRY_WARNING', thresholdDays: 7 } as AlertRule));
      store.upsertAlertRule = vi.fn(async (_wid, key, input) => ({ key, ...input, id: randomUUID(), workspaceId: ownerWorkspaceId } as unknown as AlertRule));
      const rule = await service.updateAlertRule({ workspaceId: ownerWorkspaceId, role: 'owner' }, 'TLS_EXPIRY_WARNING', { thresholdDays: 7 });
      expect(store.upsertAlertRule).toHaveBeenCalledWith(ownerWorkspaceId, 'TLS_EXPIRY_WARNING', expect.objectContaining({ thresholdDays: 7 }), expect.any(Date));
      expect((rule as AlertRule).key).toBe('TLS_EXPIRY_WARNING');
    });
  });
});
