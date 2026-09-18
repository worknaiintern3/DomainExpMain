import { randomUUID } from 'node:crypto';

import {
  alertEvents,
  alertRules,
  createDatabaseClient,
  domains,
  monitoringTargets,
  users,
  workspaceMembers,
  workspaces,
  type DatabaseClient,
} from '@domainpulse/database';
import { eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AlertActiveConflictError } from '../src/alerts/alert.types';
import type { AlertEventInput } from '../src/alerts/alert.types';
import { PostgresAlertRepository } from '../src/alerts/alert-repository';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
  resolveMigrationsFolder,
} from './alert-integration-helpers';

const describeWithPostgreSql = hasDisposableTestDatabase
  ? describe
  : describe.skip;

const migrationsFolder = resolveMigrationsFolder();

interface Fixture {
  readonly domainId: string;
  readonly ruleId: string;
  readonly targetId: string;
  readonly workspaceId: string;
}

const createdWorkspaceIds: string[] = [];
const createdUserIds: string[] = [];

let client: DatabaseClient | undefined;

function getClient(): DatabaseClient {
  if (!client) throw new Error('Alert repository test client was not initialized');
  return client;
}

function repository(): PostgresAlertRepository {
  return new PostgresAlertRepository(getClient());
}

async function makeFixture(label: string): Promise<Fixture> {
  const workspaceId = randomUUID();
  const domainId = randomUUID();
  const targetId = randomUUID();
  const ruleId = randomUUID();
  await getClient().transaction(async (transaction) => {
    await transaction.insert(workspaces).values({
      id: workspaceId,
      name: `Alert repo ${label}`,
      slug: `alert-repo-${label}-${workspaceId}`,
    });
    await transaction.insert(domains).values({
      domainName: `${label}-${domainId}.example`,
      id: domainId,
      normalizedDomainName: `${label}-${domainId}.example`,
      provenance: 'USER_ADDED',
      workspaceId,
    });
    await transaction.insert(monitoringTargets).values({
      domainId,
      id: targetId,
      workspaceId,
    });
    await transaction.insert(alertRules).values({
      id: ruleId,
      key: 'DNS_CHANGED',
      severity: 'INFO',
      workspaceId,
    });
  });
  createdWorkspaceIds.push(workspaceId);
  return { domainId, ruleId, targetId, workspaceId };
}

async function makeAcker(label: string, workspaceId: string): Promise<string> {
  const personalWorkspaceId = randomUUID();
  const userId = randomUUID();
  await getClient().transaction(async (transaction) => {
    await transaction.insert(workspaces).values({
      id: personalWorkspaceId,
      name: `Alert repo acker ${label}`,
      slug: `alert-repo-acker-${userId}`,
    });
    await transaction.insert(users).values({
      email: `${userId}@example.test`,
      id: userId,
      normalizedEmail: `${userId}@example.test`,
      personalWorkspaceId,
    });
    await transaction.insert(workspaceMembers).values({
      role: 'admin',
      userId,
      workspaceId,
    });
  });
  createdWorkspaceIds.push(personalWorkspaceId);
  createdUserIds.push(userId);
  return userId;
}

function eventInput(
  fixture: Fixture,
  dedupeKey: string,
  now: Date,
  evidence: Record<string, unknown> = {},
): AlertEventInput {
  return {
    dedupeKey,
    detail: 'Normalized DNS metadata changed.',
    domainId: fixture.domainId,
    evidence,
    now,
    ruleId: fixture.ruleId,
    severity: 'INFO',
    targetId: fixture.targetId,
    title: 'DNS metadata changed',
    workspaceId: fixture.workspaceId,
  };
}

async function acknowledgeEvent(
  eventId: string,
  userId: string,
  ackedAt: Date,
): Promise<void> {
  await getClient().transaction(async (transaction) => {
    await transaction
      .update(alertEvents)
      .set({
        ackedAt,
        ackedByUserId: userId,
        status: 'ACKNOWLEDGED' as const,
        updatedAt: ackedAt,
      })
      .where(eq(alertEvents.id, eventId));
  });
}

async function readEventRow(eventId: string) {
  const rows = await getClient()
    .database.select()
    .from(alertEvents)
    .where(eq(alertEvents.id, eventId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error('Alert event row was not found');
  return row;
}

describeWithPostgreSql(
  'alert repository PostgreSQL integration (requires disposable TEST_DATABASE_URL)',
  () => {
    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, { migrationsFolder });
    });

    afterAll(async () => {
      if (client) {
        const database = client.database;
        await database
          .delete(alertEvents)
          .where(inArray(alertEvents.workspaceId, createdWorkspaceIds));
        await database
          .delete(alertRules)
          .where(inArray(alertRules.workspaceId, createdWorkspaceIds));
        await database
          .delete(monitoringTargets)
          .where(inArray(monitoringTargets.workspaceId, createdWorkspaceIds));
        await database
          .delete(workspaceMembers)
          .where(inArray(workspaceMembers.workspaceId, createdWorkspaceIds));
        await database.delete(users).where(inArray(users.id, createdUserIds));
        await database
          .delete(domains)
          .where(inArray(domains.workspaceId, createdWorkspaceIds));
        await database
          .delete(workspaces)
          .where(inArray(workspaces.id, createdWorkspaceIds));
        await client.close();
        client = undefined;
      }
      createdWorkspaceIds.length = 0;
      createdUserIds.length = 0;
    });

    it('inserts an OPEN alert that persists correctly', async () => {
      const fixture = await makeFixture('insert');
      const now = new Date('2026-04-01T00:00:00.000Z');
      const evidence = {
        currentFingerprint: 'c'.repeat(64),
        evaluatedAt: now.toISOString(),
        previousFingerprint: 'a'.repeat(64),
        ruleKey: 'DNS_CHANGED',
      };
      await repository().insertEvent(
        eventInput(fixture, `dns-changed:${fixture.domainId}`, now, evidence),
      );
      const active = await repository().readActiveEvents(
        fixture.workspaceId,
        fixture.domainId,
      );
      expect(active).toHaveLength(1);
      expect(active[0]).toMatchObject({
        dedupeKey: `dns-changed:${fixture.domainId}`,
        status: 'OPEN',
      });
      if (!active[0]) throw new Error('Active alert event is missing');
      const row = await readEventRow(active[0].id);
      expect(row).toMatchObject({
        detail: 'Normalized DNS metadata changed.',
        domainId: fixture.domainId,
        evidence,
        occurrenceCount: 1,
        ruleId: fixture.ruleId,
        severity: 'INFO',
        status: 'OPEN',
        targetId: fixture.targetId,
        title: 'DNS metadata changed',
        workspaceId: fixture.workspaceId,
      });
      expect(row.ackedAt).toBeNull();
      expect(row.ackedByUserId).toBeNull();
      expect(row.resolvedAt).toBeNull();
      expect(row.firstSeenAt).toBeInstanceOf(Date);
      expect(row.lastSeenAt.getTime()).toBeGreaterThanOrEqual(
        row.firstSeenAt.getTime(),
      );
    });

    it('touches the same active row with incremented count and fresh timestamp', async () => {
      const fixture = await makeFixture('touch');
      await repository().insertEvent(
        eventInput(fixture, `dns-changed:${fixture.domainId}`, new Date(), {
          revision: 1,
        }),
      );
      const before = await repository().readActiveEvents(
        fixture.workspaceId,
        fixture.domainId,
      );
      if (!before[0]) throw new Error('Active alert event is missing');
      const seededRow = await readEventRow(before[0].id);
      const lastSeen = new Date(seededRow.firstSeenAt.getTime() + 60_000);
      await repository().touchEvent(
        fixture.workspaceId,
        before[0].id,
        { revision: 2 },
        lastSeen,
      );
      const after = await repository().readActiveEvents(
        fixture.workspaceId,
        fixture.domainId,
      );
      expect(after).toHaveLength(1);
      expect(after[0]?.id).toBe(before[0].id);
      expect(after[0]).toMatchObject({ status: 'OPEN' });
      const row = await readEventRow(before[0].id);
      expect(row.occurrenceCount).toBe(2);
      expect(row.lastSeenAt.getTime()).toBe(lastSeen.getTime());
      expect(row.firstSeenAt.getTime()).toBe(seededRow.firstSeenAt.getTime());
      expect(row.evidence).toEqual({ revision: 2 });
    });

    it('keeps an ACKNOWLEDGED event acknowledged when touched', async () => {
      const fixture = await makeFixture('ack');
      const ackedBy = await makeAcker('ack', fixture.workspaceId);
      await repository().insertEvent(
        eventInput(fixture, `dns-changed:${fixture.domainId}`, new Date()),
      );
      const before = await repository().readActiveEvents(
        fixture.workspaceId,
        fixture.domainId,
      );
      if (!before[0]) throw new Error('Active alert event is missing');
      const seededRow = await readEventRow(before[0].id);
      const ackedAt = new Date(seededRow.firstSeenAt.getTime() + 60_000);
      await acknowledgeEvent(before[0].id, ackedBy, ackedAt);
      const touchedAt = new Date(seededRow.firstSeenAt.getTime() + 120_000);
      await repository().touchEvent(
        fixture.workspaceId,
        before[0].id,
        { revision: 'ack-touch' },
        touchedAt,
      );
      const row = await readEventRow(before[0].id);
      expect(row.status).toBe('ACKNOWLEDGED');
      expect(row.occurrenceCount).toBe(2);
      expect(row.ackedAt?.getTime()).toBe(ackedAt.getTime());
      expect(row.ackedByUserId).toBe(ackedBy);
      expect(row.resolvedAt).toBeNull();
      expect(row.lastSeenAt.getTime()).toBe(touchedAt.getTime());
    });

    it('resolves only the targeted active event', async () => {
      const fixture = await makeFixture('resolve');
      const ackedBy = await makeAcker('resolve', fixture.workspaceId);
      const openedAt = new Date('2026-04-01T00:00:00.000Z');
      const resolvedAt = new Date('2026-04-05T00:00:00.000Z');
      const openKey = `dns-changed:${fixture.domainId}`;
      const ackKey = `cert-changed:${fixture.domainId}`;
      const alreadyKey = `retrieval-failure:${fixture.domainId}`;
      const repo = repository();
      await repo.insertEvent(eventInput(fixture, openKey, openedAt));
      await repo.insertEvent(eventInput(fixture, ackKey, openedAt));
      const seeded = await repo.readActiveEvents(
        fixture.workspaceId,
        fixture.domainId,
      );
      const ackEvent = seeded.find((event) => event.dedupeKey === ackKey);
      if (!ackEvent) throw new Error('ACK fixture event is missing');
      await acknowledgeEvent(ackEvent.id, ackedBy, openedAt);
      const priorResolvedAt = new Date('2026-04-02T00:00:00.000Z');
      await getClient().transaction(async (transaction) => {
        await transaction.insert(alertEvents).values({
          dedupeKey: alreadyKey,
          detail: 'Already resolved.',
          domainId: fixture.domainId,
          evidence: {},
          resolvedAt: priorResolvedAt,
          ruleId: fixture.ruleId,
          severity: 'INFO',
          status: 'RESOLVED' as const,
          targetId: fixture.targetId,
          title: 'Already resolved',
          workspaceId: fixture.workspaceId,
        });
      });

      await repo.resolveByDedupe(fixture.workspaceId, openKey, resolvedAt);

      const remaining = await repo.readActiveEvents(
        fixture.workspaceId,
        fixture.domainId,
      );
      expect(remaining.map((event) => event.dedupeKey)).toEqual([ackKey]);
      const openRows = await getClient()
        .database.select()
        .from(alertEvents)
        .where(eq(alertEvents.dedupeKey, openKey));
      expect(openRows).toHaveLength(1);
      expect(openRows[0]).toMatchObject({
        resolvedAt,
        status: 'RESOLVED',
      });
      const alreadyRows = await getClient()
        .database.select()
        .from(alertEvents)
        .where(eq(alertEvents.dedupeKey, alreadyKey));
      expect(alreadyRows).toHaveLength(1);
      expect(alreadyRows[0]?.resolvedAt?.getTime()).toBe(
        priorResolvedAt.getTime(),
      );
    });

    it('never reopens or mutates a resolved event', async () => {
      const fixture = await makeFixture('immutable');
      const resolvedAt = new Date('2026-04-02T00:00:00.000Z');
      const dedupeKey = `dns-changed:${fixture.domainId}`;
      const [seeded] = await getClient()
        .transaction(async (transaction) =>
          await transaction
            .insert(alertEvents)
            .values({
              dedupeKey,
              detail: 'Resolved.',
              domainId: fixture.domainId,
              evidence: { revision: 1 },
              resolvedAt,
              ruleId: fixture.ruleId,
              severity: 'INFO',
              status: 'RESOLVED' as const,
              targetId: fixture.targetId,
              title: 'Resolved',
              workspaceId: fixture.workspaceId,
            })
            .returning({ id: alertEvents.id }),
        );
      if (!seeded) throw new Error('Resolved fixture was not created');
      await repository().touchEvent(
        fixture.workspaceId,
        seeded.id,
        { revision: 2 },
        new Date('2026-04-06T00:00:00.000Z'),
      );
      await repository().resolveByDedupe(
        fixture.workspaceId,
        dedupeKey,
        new Date('2026-04-07T00:00:00.000Z'),
      );
      const row = await readEventRow(seeded.id);
      expect(row).toMatchObject({
        evidence: { revision: 1 },
        occurrenceCount: 1,
        status: 'RESOLVED',
      });
      expect(row.resolvedAt?.getTime()).toBe(resolvedAt.getTime());
      expect(
        await repository().readActiveEvents(
          fixture.workspaceId,
          fixture.domainId,
        ),
      ).toHaveLength(0);
    });

    it('creates a NEW OPEN row when the condition recurs after resolution', async () => {
      const fixture = await makeFixture('recur');
      const resolvedAt = new Date('2026-04-02T00:00:00.000Z');
      const dedupeKey = `dns-changed:${fixture.domainId}`;
      const [seeded] = await getClient()
        .transaction(async (transaction) =>
          await transaction
            .insert(alertEvents)
            .values({
              dedupeKey,
              detail: 'Resolved.',
              domainId: fixture.domainId,
              evidence: {},
              resolvedAt,
              ruleId: fixture.ruleId,
              severity: 'INFO',
              status: 'RESOLVED' as const,
              targetId: fixture.targetId,
              title: 'Resolved',
              workspaceId: fixture.workspaceId,
            })
            .returning({ id: alertEvents.id }),
        );
      if (!seeded) throw new Error('Resolved fixture was not created');
      await repository().insertEvent(
        eventInput(
          fixture,
          dedupeKey,
          new Date('2026-04-08T00:00:00.000Z'),
        ),
      );
      const active = await repository().readActiveEvents(
        fixture.workspaceId,
        fixture.domainId,
      );
      expect(active).toHaveLength(1);
      expect(active[0]?.id).not.toBe(seeded.id);
      expect(active[0]).toMatchObject({ status: 'OPEN' });
      if (!active[0]) throw new Error('Active alert event is missing');
      const freshRow = await readEventRow(active[0].id);
      expect(freshRow.occurrenceCount).toBe(1);
      const oldRow = await readEventRow(seeded.id);
      expect(oldRow).toMatchObject({ status: 'RESOLVED' });
      expect(oldRow.resolvedAt?.getTime()).toBe(resolvedAt.getTime());
    });

    it('leaves exactly one active event under concurrent same-dedupe inserts', async () => {
      const fixture = await makeFixture('race');
      const repo = repository();
      const input = eventInput(
        fixture,
        `dns-changed:${fixture.domainId}`,
        new Date('2026-04-09T00:00:00.000Z'),
      );
      const outcomes = await Promise.allSettled([
        repo.insertEvent(input),
        repo.insertEvent(input),
      ]);
      const fulfilled = outcomes.filter(
        (outcome) => outcome.status === 'fulfilled',
      );
      const rejected = outcomes.filter(
        (outcome) => outcome.status === 'rejected',
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const [failure] = rejected;
      if (!failure) {
        throw new Error('Expected one concurrent insert to conflict');
      }
      expect(failure.reason).toBeInstanceOf(AlertActiveConflictError);
      const active = await repo.readActiveEvents(
        fixture.workspaceId,
        fixture.domainId,
      );
      expect(active).toHaveLength(1);
      expect(active[0]).toMatchObject({ status: 'OPEN' });
      if (!active[0]) throw new Error('Active alert event is missing');
      const winnerRow = await readEventRow(active[0].id);
      expect(winnerRow.occurrenceCount).toBe(1);
    });

    it('persists safe evidence without raw TXT, PEM, or secrets', async () => {
      const fixture = await makeFixture('evidence');
      const evidence = {
        currentFingerprint:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        evaluatedAt: '2026-04-10T00:00:00.000Z',
        previousFingerprint:
          'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
        ruleKey: 'DNS_CHANGED',
      };
      await repository().insertEvent(
        eventInput(fixture, `dns-changed:${fixture.domainId}`, new Date(), evidence),
      );
      const active = await repository().readActiveEvents(
        fixture.workspaceId,
        fixture.domainId,
      );
      if (!active[0]) throw new Error('Active alert event is missing');
      const row = await readEventRow(active[0].id);
      expect(row.evidence).toEqual(evidence);
      const serialized = JSON.stringify({
        detail: row.detail,
        evidence: row.evidence,
        title: row.title,
      });
      for (const forbidden of [
        'BEGIN CERTIFICATE',
        'BEGIN PRIVATE KEY',
        'v=spf1',
        'password',
        'token',
        'DATABASE_URL',
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    });

    it('reports missing snapshots as not usable', async () => {
      const fixture = await makeFixture('snapshots');
      const state = await repository().loadEvaluationState(
        fixture.workspaceId,
        fixture.domainId,
        fixture.targetId,
      );
      expect(state.snapshots).toEqual({ dns: null, rdap: null, tls: null });
      expect(state.consecutiveFailures).toBe(0);
      expect(state.rules).toHaveLength(1);
      expect(state.activeEvents).toHaveLength(0);
    });
  },
);
