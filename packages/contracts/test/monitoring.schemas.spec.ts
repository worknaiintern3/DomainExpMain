import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  AlertEventResponseSchema,
  AlertRuleResponseSchema,
  CreateMonitoringTargetRequestSchema,
  MonitoringRunCollectionResponseSchema,
  MonitoringRunResponseSchema,
  MonitoringRunStatusSchema,
  MonitoringTargetResponseSchema,
  UpdateMonitoringTargetRequestSchema,
} from '../src';

const now = '2026-09-12T08:30:00.000Z';
const ids = {
  domain: randomUUID(),
  event: randomUUID(),
  rule: randomUUID(),
  run: randomUUID(),
  target: randomUUID(),
  user: randomUUID(),
};

const target = {
  checkIntervalMinutes: 1_440,
  consecutiveFailures: 0,
  createdAt: now,
  domainId: ids.domain,
  enabled: true,
  id: ids.target,
  lastRunAt: null,
  lastRunStatus: null,
  nextRunAt: null,
  updatedAt: now,
};

const run = {
  attemptNo: 1,
  createdAt: now,
  domainId: ids.domain,
  durationMs: 250,
  errorCode: null,
  finishedAt: now,
  id: ids.run,
  sourcesAttempted: ['rdap', 'dns', 'tls'],
  sourcesSucceeded: ['rdap', 'dns', 'tls'],
  startedAt: now,
  status: 'SUCCESS',
  targetId: ids.target,
  trigger: 'SCHEDULED',
};

describe('monitoring contracts', () => {
  it('accepts only the bounded public target-create fields', () => {
    expect(
      CreateMonitoringTargetRequestSchema.parse({
        checkIntervalMinutes: 60,
        domainId: ids.domain,
      }),
    ).toMatchObject({ checkIntervalMinutes: 60, domainId: ids.domain });
    expect(
      CreateMonitoringTargetRequestSchema.safeParse({
        checkIntervalMinutes: 59,
        domainId: ids.domain,
      }).success,
    ).toBe(false);
    expect(
      CreateMonitoringTargetRequestSchema.safeParse({
        checkIntervalMinutes: 10_081,
        domainId: ids.domain,
      }).success,
    ).toBe(false);
  });

  it('rejects workspace identity and unknown target mutation fields', () => {
    expect(
      CreateMonitoringTargetRequestSchema.safeParse({
        domainId: ids.domain,
        workspaceId: randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      UpdateMonitoringTargetRequestSchema.safeParse({
        enabled: false,
        nextRunAt: now,
      }).success,
    ).toBe(false);
    expect(UpdateMonitoringTargetRequestSchema.safeParse({}).success).toBe(
      false,
    );
  });

  it('keeps inventory, metadata, run, and alert states separate', () => {
    expect(MonitoringRunStatusSchema.safeParse('PARTIAL').success).toBe(true);
    expect(MonitoringRunStatusSchema.safeParse('HEALTHY').success).toBe(false);
    expect(MonitoringRunStatusSchema.safeParse('TRACKED').success).toBe(false);
    expect(MonitoringRunStatusSchema.safeParse('OPEN').success).toBe(false);
  });

  it('strictly validates target and run responses without workspace identity', () => {
    expect(MonitoringTargetResponseSchema.safeParse(target).success).toBe(true);
    expect(MonitoringRunResponseSchema.safeParse(run).success).toBe(true);
    expect(
      MonitoringTargetResponseSchema.safeParse({
        ...target,
        workspaceId: randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      MonitoringRunResponseSchema.safeParse({
        ...run,
        idempotencyKey: 'internal-key',
      }).success,
    ).toBe(false);
  });

  it('strictly validates run collections', () => {
    expect(
      MonitoringRunCollectionResponseSchema.safeParse({
        items: [run],
        nextCursor: null,
      }).success,
    ).toBe(true);
    expect(
      MonitoringRunCollectionResponseSchema.safeParse({
        items: [run],
        nextCursor: null,
        workspaceId: randomUUID(),
      }).success,
    ).toBe(false);
  });

  it('rejects response states with contradictory timestamps or thresholds', () => {
    expect(
      MonitoringRunResponseSchema.safeParse({
        ...run,
        errorCode: 'RETRIEVAL_FAILED',
        status: 'SUCCESS',
      }).success,
    ).toBe(false);
    expect(
      AlertRuleResponseSchema.safeParse({
        createdAt: now,
        enabled: true,
        id: ids.rule,
        key: 'DNS_CHANGED',
        severity: 'INFO',
        thresholdCount: 2,
        thresholdDays: null,
        updatedAt: now,
      }).success,
    ).toBe(false);
    expect(
      AlertEventResponseSchema.safeParse({
        ackedAt: now,
        ackedByUserId: ids.user,
        createdAt: now,
        detail: 'Contradictory open event.',
        domainId: ids.domain,
        evidence: {},
        firstSeenAt: now,
        id: ids.event,
        lastSeenAt: now,
        occurrenceCount: 1,
        resolvedAt: null,
        ruleId: null,
        severity: 'INFO',
        status: 'OPEN',
        targetId: null,
        title: 'Contradictory alert',
        updatedAt: now,
      }).success,
    ).toBe(false);
  });

  it('strictly validates safe alert rule and event responses', () => {
    expect(
      AlertRuleResponseSchema.safeParse({
        createdAt: now,
        enabled: true,
        id: ids.rule,
        key: 'RETRIEVAL_FAILURE_REPEATED',
        severity: 'WARNING',
        thresholdCount: 3,
        thresholdDays: null,
        updatedAt: now,
      }).success,
    ).toBe(true);
    expect(
      AlertEventResponseSchema.safeParse({
        ackedAt: now,
        ackedByUserId: ids.user,
        createdAt: now,
        detail: 'Three consecutive metadata retrievals failed.',
        domainId: ids.domain,
        evidence: { failureCount: 3 },
        firstSeenAt: now,
        id: ids.event,
        lastSeenAt: now,
        occurrenceCount: 3,
        resolvedAt: null,
        ruleId: ids.rule,
        severity: 'WARNING',
        status: 'ACKNOWLEDGED',
        targetId: ids.target,
        title: 'Repeated retrieval failure',
        updatedAt: now,
      }).success,
    ).toBe(true);
  });
});
