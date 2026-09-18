import { randomUUID } from 'node:crypto';

import {
  alertEvents,
  alertRules,
  createDatabaseClient,
  domains,
  monitoringRuns,
  monitoringTargets,
  users,
  workspaceMembers,
  workspaces,
  type DatabaseClient,
} from '@domainpulse/database';
import { and, eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AlertAcknowledgeForbiddenError,
  AlertNotFoundError,
  MonitoringTargetNotFoundError,
} from '../src/monitoring/monitoring.errors';
import { PostgresMonitoringRepository } from '../src/monitoring/monitoring.repository';
import { MonitoringService } from '../src/monitoring/monitoring.service';

import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

const now = new Date('2036-02-03T04:05:06.000Z');

type Uuid = ReturnType<typeof randomUUID>;
const newUuid = (): Uuid => randomUUID();

function principal(workspaceId: Uuid, role: 'owner' | 'admin' | 'member' = 'owner', userId: Uuid = newUuid()) {
  return {
    membershipId: newUuid(),
    role,
    sessionId: newUuid(),
    userId,
    workspaceId,
  };
}

describeWithPostgreSql('monitoring persistence (requires disposable TEST_DATABASE_URL)', () => {
  const workspaceAId = newUuid();
  const workspaceBId = newUuid();
  const domainAId = newUuid();
  const domainBId = newUuid();
  let client: DatabaseClient | undefined;
  let repository: PostgresMonitoringRepository | undefined;
  let service: MonitoringService | undefined;
  let ackerUserId: Uuid | undefined;

  const getClient = () => {
    if (!client) throw new Error('Monitoring integration client not initialized');
    return client;
  };
  const getRepository = () => {
    if (!repository) throw new Error('Monitoring repository not initialized');
    return repository;
  };
  const getService = () => {
    if (!service) throw new Error('Monitoring service not initialized');
    return service;
  };

  beforeAll(async () => {
    client = createDatabaseClient(getDisposableTestConfiguration());
    await migrate(client.database, { migrationsFolder: '../../packages/database/migrations' });

    // workspaces
    await client.database.insert(workspaces).values([
      { id: workspaceAId, name: 'Monitoring A', slug: `monitoring-a-${workspaceAId}` },
      { id: workspaceBId, name: 'Monitoring B', slug: `monitoring-b-${workspaceBId}` },
    ]);

    // domains
    await client.database.insert(domains).values([
      {
        domainName: `a-${domainAId}.example`,
        id: domainAId,
        normalizedDomainName: `a-${domainAId}.example`,
        provenance: 'USER_ADDED',
        workspaceId: workspaceAId,
      },
      {
        domainName: `b-${domainBId}.example`,
        id: domainBId,
        normalizedDomainName: `b-${domainBId}.example`,
        provenance: 'USER_ADDED',
        workspaceId: workspaceBId,
      },
    ]);

    // user + member for workspace A (needed for alert ack FK)
    const personalWorkspaceId = newUuid();
    ackerUserId = newUuid();
    await client.database.insert(workspaces).values({
      id: personalWorkspaceId,
      name: `Monitoring acker personal`,
      slug: `monitoring-acker-${ackerUserId}`,
    });
    await client.database.insert(users).values({
      email: `${ackerUserId}@example.test`,
      id: ackerUserId,
      normalizedEmail: `${ackerUserId}@example.test`,
      personalWorkspaceId,
    });
    await client.database.insert(workspaceMembers).values({
      role: 'admin',
      userId: ackerUserId,
      workspaceId: workspaceAId,
    });

    repository = new PostgresMonitoringRepository(client);
    service = new MonitoringService(repository, () => now);
  });

  afterAll(async () => {
    if (!client) return;
    const db = client.database;
    // order respecting FK
    await db.delete(alertEvents).where(inArray(alertEvents.workspaceId, [workspaceAId, workspaceBId]));
    await db.delete(alertRules).where(inArray(alertRules.workspaceId, [workspaceAId, workspaceBId]));
    await db.delete(monitoringRuns).where(inArray(monitoringRuns.workspaceId, [workspaceAId, workspaceBId]));
    await db.delete(monitoringTargets).where(inArray(monitoringTargets.workspaceId, [workspaceAId, workspaceBId]));
    if (ackerUserId) {
      await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, ackerUserId));
      await db.delete(users).where(eq(users.id, ackerUserId));
    }
    await db.delete(domains).where(inArray(domains.workspaceId, [workspaceAId, workspaceBId]));
    // delete personal workspace for acker
    if (ackerUserId) {
      const [user] = await db.select({ personalWorkspaceId: users.personalWorkspaceId }).from(users).where(eq(users.id, ackerUserId)).limit(1);
      if (user) {
        await db.delete(workspaces).where(eq(workspaces.id, user.personalWorkspaceId));
      }
    }
    await db.delete(workspaces).where(inArray(workspaces.id, [workspaceAId, workspaceBId]));
    await client.close();
  });

  it('configuring monitoring target persists correctly', async () => {
    const svc = getService();
    const target = await svc.configureTarget(principal(workspaceAId), domainAId, { enabled: true, checkIntervalMinutes: 60 });
    expect(target).toMatchObject({ domainId: domainAId, enabled: true, checkIntervalMinutes: 60, workspaceId: workspaceAId });
    expect(target.nextRunAt).toBeInstanceOf(Date);
    // verify via repository / DB
    const fromDb = await getRepository().findTargetByDomainId(workspaceAId, domainAId);
    expect(fromDb).toMatchObject({ id: target.id, checkIntervalMinutes: 60 });
    const [row] = await getClient().database.select().from(monitoringTargets).where(and(eq(monitoringTargets.workspaceId, workspaceAId), eq(monitoringTargets.domainId, domainAId))).limit(1);
    expect(row?.checkIntervalMinutes).toBe(60);
    expect(row?.enabled).toBe(true);
  });

  it('updating target persists correctly', async () => {
    const svc = getService();
    const before = await getRepository().findTargetByDomainId(workspaceAId, domainAId);
    expect(before).toBeDefined();
    const updated = await svc.configureTarget(principal(workspaceAId), domainAId, { checkIntervalMinutes: 120 });
    expect(updated.checkIntervalMinutes).toBe(120);
    expect(updated.id).toBe(before?.id);
    const fromDb = await getRepository().findTargetByDomainId(workspaceAId, domainAId);
    expect(fromDb?.checkIntervalMinutes).toBe(120);
  });

  it('disabling target preserves monitoring history', async () => {
    const svc = getService();
    // ensure at least one run exists for history
    const target = await getRepository().findTargetByDomainId(workspaceAId, domainAId);
    if (!target) throw new Error('Target not found');
    // create a run to have history
    await svc.enqueueManualRun(principal(workspaceAId, 'owner', ackerUserId!), domainAId, `history-${newUuid()}`);
    const runsBefore = await getClient().database.select().from(monitoringRuns).where(and(eq(monitoringRuns.workspaceId, workspaceAId), eq(monitoringRuns.targetId, target.id)));
    expect(runsBefore.length).toBeGreaterThan(0);
    const disabled = await svc.configureTarget(principal(workspaceAId), domainAId, { enabled: false });
    expect(disabled.enabled).toBe(false);
    expect(disabled.nextRunAt).toBeNull();
    // history still there
    const runsAfter = await getClient().database.select().from(monitoringRuns).where(and(eq(monitoringRuns.workspaceId, workspaceAId), eq(monitoringRuns.targetId, target.id)));
    expect(runsAfter.length).toBe(runsBefore.length);
    // re-enable for further tests
    const reenabled = await svc.configureTarget(principal(workspaceAId), domainAId, { enabled: true });
    expect(reenabled.enabled).toBe(true);
    expect(reenabled.nextRunAt).not.toBeNull();
  });

  it('manual run persists: trigger MANUAL, status QUEUED, attempt_no 1', async () => {
    const svc = getService();
    const beforeNextRunAt = (await getRepository().findTargetByDomainId(workspaceAId, domainAId))?.nextRunAt;
    const result = await svc.enqueueManualRun(principal(workspaceAId, 'owner', ackerUserId!), domainAId, `manual-${newUuid()}`);
    expect(result).toMatchObject({ status: 'QUEUED', trigger: 'MANUAL' });
    const [row] = await getClient().database.select().from(monitoringRuns).where(eq(monitoringRuns.id, result.id as Uuid)).limit(1);
    expect(row).toBeDefined();
    expect(row?.trigger).toBe('MANUAL');
    expect(row?.status).toBe('QUEUED');
    expect(row?.attemptNo).toBe(1);
    expect(row?.availableAt).toBeInstanceOf(Date);
    // nextRunAt unchanged
    const afterNextRunAt = (await getRepository().findTargetByDomainId(workspaceAId, domainAId))?.nextRunAt;
    expect(afterNextRunAt?.getTime()).toBe(beforeNextRunAt?.getTime());
  });

  it('same Idempotency-Key results in one DB run', async () => {
    const svc = getService();
    const target = await getRepository().findTargetByDomainId(workspaceAId, domainAId);
    if (!target) throw new Error('Target missing');
    const key = `same-${newUuid()}`;
    const first = await svc.enqueueManualRun(principal(workspaceAId, 'owner', ackerUserId!), domainAId, key);
    const second = await svc.enqueueManualRun(principal(workspaceAId, 'owner', ackerUserId!), domainAId, key);
    expect(first.id).toBe(second.id);
    const { createHash } = await import('node:crypto');
    const internal = createHash('sha256').update(`${target.id}:${key}`).digest('hex');
    const rows = await getClient().database.select().from(monitoringRuns).where(and(eq(monitoringRuns.workspaceId, workspaceAId), eq(monitoringRuns.targetId, target.id), eq(monitoringRuns.idempotencyKey, internal)));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(first.id);
  });

  it('concurrent same Idempotency-Key leaves exactly one run', async () => {
    const svc = getService();
    const target = await getRepository().findTargetByDomainId(workspaceAId, domainAId);
    if (!target) throw new Error('Target missing');
    const key = `concurrent-${newUuid()}`;
    const [a, b] = await Promise.all([
      svc.enqueueManualRun(principal(workspaceAId, 'owner', ackerUserId!), domainAId, key),
      svc.enqueueManualRun(principal(workspaceAId, 'owner', ackerUserId!), domainAId, key),
    ]);
    expect(a.id).toBe(b.id);
    const { createHash } = await import('node:crypto');
    const internal = createHash('sha256').update(`${target.id}:${key}`).digest('hex');
    const rows = await getClient().database.select().from(monitoringRuns).where(and(eq(monitoringRuns.workspaceId, workspaceAId), eq(monitoringRuns.targetId, target.id), eq(monitoringRuns.idempotencyKey, internal)));
    expect(rows).toHaveLength(1);
  });

  it('different Idempotency-Key creates a different run', async () => {
    const svc = getService();
    const first = await svc.enqueueManualRun(principal(workspaceAId, 'owner', ackerUserId!), domainAId, `diff-${newUuid()}`);
    const second = await svc.enqueueManualRun(principal(workspaceAId, 'owner', ackerUserId!), domainAId, `diff-${newUuid()}`);
    expect(first.id).not.toBe(second.id);
    const rows = await getClient().database.select().from(monitoringRuns).where(and(eq(monitoringRuns.workspaceId, workspaceAId), eq(monitoringRuns.domainId, domainAId)));
    // at least the two we just created exist
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.has(first.id as Uuid)).toBe(true);
    expect(ids.has(second.id as Uuid)).toBe(true);
  });

  it('manual run does NOT change scheduled next_run_at', async () => {
    const svc = getService();
    const before = (await getRepository().findTargetByDomainId(workspaceAId, domainAId))?.nextRunAt;
    expect(before).not.toBeNull();
    await svc.enqueueManualRun(principal(workspaceAId, 'owner', ackerUserId!), domainAId, `nextrun-${newUuid()}`);
    const after = (await getRepository().findTargetByDomainId(workspaceAId, domainAId))?.nextRunAt;
    expect(after?.getTime()).toBe(before?.getTime());
  });

  it('OPEN alert acknowledgement persists: status ACKNOWLEDGED, acknowledged_at, acknowledged_by_user_id', async () => {
    const repo = getRepository();
    const svc = getService();
    // create an OPEN alert directly via DB (bypass service, to have known state)
    const alertId: Uuid = newUuid();
    const target = await repo.findTargetByDomainId(workspaceAId, domainAId);
    await getClient().database.insert(alertEvents).values({
      id: alertId,
      dedupeKey: `ack-test-${alertId}`,
      detail: 'Test alert',
      domainId: domainAId,
      evidence: {},
      severity: 'INFO',
      status: 'OPEN',
      targetId: target?.id ?? null,
      title: 'Test alert',
      workspaceId: workspaceAId,
    });
    const before = await getClient().database.select().from(alertEvents).where(eq(alertEvents.id, alertId)).limit(1);
    expect(before[0]?.status).toBe('OPEN');
    const result = await svc.acknowledgeAlert(principal(workspaceAId, 'owner', ackerUserId!), alertId);
    expect(result).toMatchObject({ id: alertId, status: 'ACKNOWLEDGED', acknowledgedByUserId: ackerUserId });
    expect(result.acknowledgedAt).toBeInstanceOf(Date);
    const [row] = await getClient().database.select().from(alertEvents).where(eq(alertEvents.id, alertId)).limit(1);
    expect(row?.status).toBe('ACKNOWLEDGED');
    expect(row?.ackedAt).toBeInstanceOf(Date);
    expect(row?.ackedByUserId).toBe(ackerUserId);
    expect(row?.resolvedAt).toBeNull();
  });

  it('ACK replay returns same ACKNOWLEDGED event', async () => {
    const svc = getService();
    // find an ACKNOWLEDGED alert from previous test
    const [acked] = await getClient().database.select().from(alertEvents).where(and(eq(alertEvents.workspaceId, workspaceAId), eq(alertEvents.status, 'ACKNOWLEDGED'))).limit(1);
    if (!acked) throw new Error('No ACKNOWLEDGED alert found for replay');
    const first = await svc.acknowledgeAlert(principal(workspaceAId, 'owner', ackerUserId!), acked.id as Uuid);
    const second = await svc.acknowledgeAlert(principal(workspaceAId, 'owner', ackerUserId!), acked.id as Uuid);
    expect(first.id).toBe(second.id);
    expect(first.status).toBe('ACKNOWLEDGED');
    expect(second.status).toBe('ACKNOWLEDGED');
    expect(first.acknowledgedAt.getTime()).toBe(second.acknowledgedAt.getTime());
    const [row] = await getClient().database.select().from(alertEvents).where(eq(alertEvents.id, acked.id as Uuid)).limit(1);
    expect(row?.status).toBe('ACKNOWLEDGED');
  });

  it('RESOLVED alert cannot be acknowledged', async () => {
    const svc = getService();
    const target = await getRepository().findTargetByDomainId(workspaceAId, domainAId);
    const resolvedId: Uuid = newUuid();
    await getClient().database.insert(alertEvents).values({
      dedupeKey: `resolved-${resolvedId}`,
      detail: 'Resolved alert',
      domainId: domainAId,
      evidence: {},
      id: resolvedId,
      resolvedAt: new Date(),
      severity: 'INFO',
      status: 'RESOLVED',
      targetId: target?.id ?? null,
      title: 'Resolved',
      workspaceId: workspaceAId,
    });
    await expect(svc.acknowledgeAlert(principal(workspaceAId, 'owner', ackerUserId!), resolvedId)).rejects.toBeInstanceOf(AlertAcknowledgeForbiddenError);
    const [row] = await getClient().database.select().from(alertEvents).where(eq(alertEvents.id, resolvedId)).limit(1);
    expect(row?.status).toBe('RESOLVED');
  });

  it('alert-rule upsert/update persists correct fields', async () => {
    const svc = getService();
    const repo = getRepository();
    // upsert DNS_CHANGED (no thresholds)
    const dnsRule = await svc.updateAlertRule(principal(workspaceAId, 'owner'), 'DNS_CHANGED', { enabled: false });
    expect((dnsRule as { key: string }).key).toBe('DNS_CHANGED');
    const dnsFromDb = await repo.findAlertRuleByKey(workspaceAId, 'DNS_CHANGED');
    expect(dnsFromDb).toMatchObject({ key: 'DNS_CHANGED', enabled: false, thresholdDays: null, thresholdCount: null });

    // upsert DOMAIN_EXPIRY_CRITICAL (requires thresholdDays)
    const expiryRule = await svc.updateAlertRule(principal(workspaceAId, 'owner'), 'DOMAIN_EXPIRY_CRITICAL', { thresholdDays: 14, enabled: true });
    expect((expiryRule as { thresholdDays: number | null }).thresholdDays).toBe(14);
    const expiryFromDb = await repo.findAlertRuleByKey(workspaceAId, 'DOMAIN_EXPIRY_CRITICAL');
    expect(expiryFromDb?.thresholdDays).toBe(14);

    // update existing to different threshold
    const updated = await svc.updateAlertRule(principal(workspaceAId, 'owner'), 'DOMAIN_EXPIRY_CRITICAL', { thresholdDays: 7 });
    expect((updated as { thresholdDays: number | null }).thresholdDays).toBe(7);
    const updatedFromDb = await repo.findAlertRuleByKey(workspaceAId, 'DOMAIN_EXPIRY_CRITICAL');
    expect(updatedFromDb?.thresholdDays).toBe(7);

    // RETRIEVAL_FAILURE_REPEATED with thresholdCount
    const retrieval = await svc.updateAlertRule(principal(workspaceAId, 'owner'), 'RETRIEVAL_FAILURE_REPEATED', { thresholdCount: 5 });
    expect((retrieval as { thresholdCount: number | null }).thresholdCount).toBe(5);
  });

  it('workspace A cannot operate on workspace B monitoring/alert/rule data', async () => {
    const svc = getService();
    const repo = getRepository();
    // ensure workspace B has its own target
    const bPrincipal = principal(workspaceBId, 'owner', newUuid());
    // create a target in B via service (need to bypass domain check? domainB exists in B)
    const bTarget = await svc.configureTarget(bPrincipal, domainBId, { enabled: true });
    expect(bTarget.workspaceId).toBe(workspaceBId);

    // A trying to get B's target via domainB should be not found
    await expect(svc.getTarget(principal(workspaceAId), domainBId)).rejects.toBeInstanceOf(MonitoringTargetNotFoundError);
    await expect(svc.listRuns(principal(workspaceAId), domainBId, {})).rejects.toBeInstanceOf(MonitoringTargetNotFoundError);
    await expect(svc.enqueueManualRun(principal(workspaceAId, 'owner', ackerUserId!), domainBId, 'x')).rejects.toBeInstanceOf(MonitoringTargetNotFoundError);

    // alert isolation: create alert in B, try to acknowledge from A
    const bAlertId: Uuid = newUuid();
    await getClient().database.insert(alertEvents).values({
      dedupeKey: `isolation-${bAlertId}`,
      detail: 'B alert',
      domainId: domainBId,
      evidence: {},
      id: bAlertId,
      severity: 'INFO',
      status: 'OPEN',
      title: 'B alert',
      workspaceId: workspaceBId,
    });
    await expect(svc.acknowledgeAlert(principal(workspaceAId, 'owner', ackerUserId!), bAlertId)).rejects.toBeInstanceOf(AlertNotFoundError);
    // rule isolation: A's rule change should not affect B
    await svc.updateAlertRule(principal(workspaceAId, 'owner'), 'DNS_CHANGED', { enabled: false });
    const bRuleBefore = await repo.findAlertRuleByKey(workspaceBId, 'DNS_CHANGED');
    // B's rule should be either not exist or still enabled true (default), not false from A
    if (bRuleBefore) {
      expect(bRuleBefore.enabled).not.toBe(false);
    }
    const bRule = await svc.updateAlertRule(bPrincipal, 'DNS_CHANGED', { enabled: true });
    expect((bRule as { workspaceId: string }).workspaceId).toBe(workspaceBId);
    const aRule = await repo.findAlertRuleByKey(workspaceAId, 'DNS_CHANGED');
    expect(aRule?.enabled).toBe(false);
  });
});
