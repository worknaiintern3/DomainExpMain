import { describe, expect, it } from 'vitest';

import { dnsFingerprint, tlsFingerprint } from '../src/alerts/alert-fingerprint';
import { AlertEvaluator } from '../src/alerts/alert-evaluator';
import type {
  AlertDnsSnapshot,
  AlertRuleKey,
  AlertRuleState,
  AlertSnapshotState,
  AlertTlsSnapshot,
  ChangeBaseline,
} from '../src/alerts/alert.types';
import type {
  ClaimedMonitoringRun,
  MonitoringExecutionResult,
  MonitoringTerminalStatus,
} from '../src/monitoring/monitoring.types';
import { InMemoryAlertStore } from './alert-test-store';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const WORKSPACE_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const WORKSPACE_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const DOMAIN_A = '11111111-0000-4000-8000-000000000001';
const TARGET_A = '22222222-0000-4000-8000-000000000001';
const RUN_A = '33333333-0000-4000-8000-000000000001';

const run: ClaimedMonitoringRun = {
  attemptNo: 1,
  domainId: DOMAIN_A,
  idempotencyKey: 'scheduled:1',
  leaseExpiresAt: new Date('2026-03-01T00:05:00.000Z'),
  runId: RUN_A,
  targetId: TARGET_A,
  workspaceId: WORKSPACE_A,
};

function result(status: MonitoringTerminalStatus): MonitoringExecutionResult {
  return {
    durationMs: 5,
    errorCode: status === 'SUCCESS' ? null : 'MONITORING_PARTIAL_FAILURE',
    finishedAt: NOW,
    retryable: false,
    sourcesAttempted: ['rdap', 'dns', 'tls'],
    sourcesSucceeded: status === 'FAILED' ? [] : ['rdap', 'dns', 'tls'],
    status,
  };
}

function rule(
  key: AlertRuleKey,
  overrides: Partial<AlertRuleState> = {},
): AlertRuleState {
  return {
    enabled: true,
    id: `rule-${key.toLowerCase()}`,
    key,
    severity: 'WARNING',
    thresholdCount: null,
    thresholdDays: null,
    ...overrides,
  };
}

function rdapSnapshots(expiresAt: Date | null): AlertSnapshotState {
  return {
    dns: null,
    rdap: { expiresAt, retrievedAt: NOW },
    tls: null,
  };
}

function dnsSnapshots(
  snapshot: AlertDnsSnapshot,
  rdap: AlertSnapshotState['rdap'] = null,
): AlertSnapshotState {
  return { dns: snapshot, rdap, tls: null };
}

function tlsSnapshots(
  snapshot: AlertTlsSnapshot,
  rdap: AlertSnapshotState['rdap'] = null,
): AlertSnapshotState {
  return { dns: null, rdap, tls: snapshot };
}

function dnsSnapshot(overrides: Partial<AlertDnsSnapshot> = {}): AlertDnsSnapshot {
  return {
    aRecords: ['93.184.216.34'],
    aaaaRecords: [],
    cnameRecords: [],
    dsRecords: [],
    lastAttemptStatus: 'SUCCESS',
    mxRecords: [{ exchange: 'mail.example.com', priority: 10 }],
    nsRecords: ['ns1.example.com'],
    retrievedAt: NOW,
    txtRecordCount: 1,
    ...overrides,
  };
}

function tlsSnapshot(overrides: Partial<AlertTlsSnapshot> = {}): AlertTlsSnapshot {
  return {
    fingerprint256: 'AA:BB:CC',
    issuerCommonName: 'Example CA',
    issuerOrganization: 'Example Org',
    lastAttemptStatus: 'SUCCESS',
    retrievedAt: NOW,
    serialNumber: '01:02',
    subjectAltNames: ['example.com'],
    subjectCommonName: 'example.com',
    validFrom: new Date('2025-01-01T00:00:00.000Z'),
    validTo: new Date('2027-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function evaluator(store: InMemoryAlertStore): AlertEvaluator {
  return new AlertEvaluator(store, { now: () => NOW });
}

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * 86_400_000);
}

describe('alert evaluator domain expiry', () => {
  it('opens a warning when inside the warning threshold only', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [
      rule('DOMAIN_EXPIRY_CRITICAL', { severity: 'CRITICAL', thresholdDays: 7 }),
      rule('DOMAIN_EXPIRY_WARNING', { severity: 'WARNING', thresholdDays: 14 }),
    ]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, rdapSnapshots(daysFromNow(10)));
    const summary = await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    expect(summary.opened).toEqual([`domain-expiry-warning:${DOMAIN_A}`]);
    const active = store.activeEvents(WORKSPACE_A, DOMAIN_A);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      severity: 'WARNING',
      status: 'OPEN',
      title: 'Domain expiry threshold reached',
    });
    expect(active[0]?.evidence).toMatchObject({
      daysRemaining: 10,
      ruleKey: 'DOMAIN_EXPIRY_WARNING',
      thresholdDays: 14,
    });
  });

  it('opens critical when inside the critical threshold', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [
      rule('DOMAIN_EXPIRY_CRITICAL', { severity: 'CRITICAL', thresholdDays: 7 }),
      rule('DOMAIN_EXPIRY_WARNING', { severity: 'WARNING', thresholdDays: 14 }),
    ]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, rdapSnapshots(daysFromNow(5)));
    const summary = await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    expect(summary.opened).toEqual([`domain-expiry-critical:${DOMAIN_A}`]);
    expect(store.activeEvents(WORKSPACE_A, DOMAIN_A)).toHaveLength(1);
  });

  it('lets critical supersede an active warning', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [
      rule('DOMAIN_EXPIRY_CRITICAL', { severity: 'CRITICAL', thresholdDays: 7 }),
      rule('DOMAIN_EXPIRY_WARNING', { severity: 'WARNING', thresholdDays: 14 }),
    ]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, rdapSnapshots(daysFromNow(5)));
    store.seedEvent({
      ackedAt: null,
      dedupeKey: `domain-expiry-warning:${DOMAIN_A}`,
      detail: 'warning',
      domainId: DOMAIN_A,
      evidence: {},
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      occurrenceCount: 1,
      resolvedAt: null,
      ruleId: 'rule-domain_expiry_warning',
      severity: 'WARNING',
      status: 'OPEN',
      targetId: TARGET_A,
      title: 'Domain expiry threshold reached',
      workspaceId: WORKSPACE_A,
    });
    const summary = await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    expect(summary.opened).toEqual([`domain-expiry-critical:${DOMAIN_A}`]);
    expect(summary.resolved).toEqual([`domain-expiry-warning:${DOMAIN_A}`]);
    const warning = store.events.find(
      (event) => event.dedupeKey === `domain-expiry-warning:${DOMAIN_A}`,
    );
    expect(warning).toMatchObject({ resolvedAt: NOW, status: 'RESOLVED' });
  });

  it('resolves active expiry alerts once evidence is safely outside thresholds', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [
      rule('DOMAIN_EXPIRY_CRITICAL', { severity: 'CRITICAL', thresholdDays: 7 }),
      rule('DOMAIN_EXPIRY_WARNING', { severity: 'WARNING', thresholdDays: 14 }),
    ]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, rdapSnapshots(daysFromNow(40)));
    for (const key of ['DOMAIN_EXPIRY_CRITICAL', 'DOMAIN_EXPIRY_WARNING'] as const) {
      store.seedEvent({
        ackedAt: null,
        dedupeKey: `${key === 'DOMAIN_EXPIRY_CRITICAL' ? 'domain-expiry-critical' : 'domain-expiry-warning'}:${DOMAIN_A}`,
        detail: 'expiry',
        domainId: DOMAIN_A,
        evidence: {},
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        occurrenceCount: 1,
        resolvedAt: null,
        ruleId: `rule-${key.toLowerCase()}`,
        severity: 'WARNING',
        status: 'OPEN',
        targetId: TARGET_A,
        title: 'Domain expiry threshold reached',
        workspaceId: WORKSPACE_A,
      });
    }
    const summary = await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    expect(summary.resolved).toHaveLength(2);
    expect(store.activeEvents(WORKSPACE_A, DOMAIN_A)).toHaveLength(0);
  });

  it('creates nothing when RDAP expiry evidence is missing', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [
      rule('DOMAIN_EXPIRY_CRITICAL', { severity: 'CRITICAL', thresholdDays: 7 }),
      rule('DOMAIN_EXPIRY_WARNING', { severity: 'WARNING', thresholdDays: 14 }),
    ]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, { dns: null, rdap: null, tls: null });
    const summary = await evaluator(store).evaluateAfterRun(run, result('FAILED'), null);
    expect(summary).toEqual({ opened: [], resolved: [], touched: [] });
    expect(store.events).toHaveLength(0);
  });

  it('leaves active expiry alerts untouched when evidence disappears', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [
      rule('DOMAIN_EXPIRY_WARNING', { severity: 'WARNING', thresholdDays: 14 }),
    ]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, { dns: null, rdap: null, tls: null });
    store.seedEvent({
      ackedAt: null,
      dedupeKey: `domain-expiry-warning:${DOMAIN_A}`,
      detail: 'warning',
      domainId: DOMAIN_A,
      evidence: {},
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      occurrenceCount: 2,
      resolvedAt: null,
      ruleId: 'rule-domain_expiry_warning',
      severity: 'WARNING',
      status: 'OPEN',
      targetId: TARGET_A,
      title: 'Domain expiry threshold reached',
      workspaceId: WORKSPACE_A,
    });
    const summary = await evaluator(store).evaluateAfterRun(run, result('FAILED'), null);
    expect(summary).toEqual({ opened: [], resolved: [], touched: [] });
    expect(store.activeEvents(WORKSPACE_A, DOMAIN_A)).toHaveLength(1);
  });

  it('ignores disabled rules and rules without thresholds', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [
      rule('DOMAIN_EXPIRY_CRITICAL', { enabled: false, thresholdDays: 30 }),
      rule('DOMAIN_EXPIRY_WARNING', { thresholdDays: null }),
    ]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, rdapSnapshots(daysFromNow(3)));
    const summary = await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    expect(summary).toEqual({ opened: [], resolved: [], touched: [] });
    expect(store.events).toHaveLength(0);
  });

  it('evaluates preserved snapshots without requiring a fresh success', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [
      rule('DOMAIN_EXPIRY_WARNING', { severity: 'WARNING', thresholdDays: 14 }),
    ]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, rdapSnapshots(daysFromNow(9)));
    const summary = await evaluator(store).evaluateAfterRun(run, result('FAILED'), null);
    expect(summary.opened).toEqual([`domain-expiry-warning:${DOMAIN_A}`]);
  });
});

describe('alert evaluator TLS expiry', () => {
  function tlsState(validTo: Date | null): AlertSnapshotState {
    return tlsSnapshots({ ...tlsSnapshot(), validTo });
  }

  it('opens warning and critical with precedence and recovery', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [
      rule('TLS_EXPIRY_CRITICAL', { severity: 'CRITICAL', thresholdDays: 7 }),
      rule('TLS_EXPIRY_WARNING', { severity: 'WARNING', thresholdDays: 14 }),
    ]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, tlsState(daysFromNow(12)));
    let summary = await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    expect(summary.opened).toEqual([`tls-expiry-warning:${DOMAIN_A}`]);

    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, tlsState(daysFromNow(2)));
    summary = await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    expect(summary.opened).toEqual([`tls-expiry-critical:${DOMAIN_A}`]);
    expect(summary.resolved).toEqual([`tls-expiry-warning:${DOMAIN_A}`]);

    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, tlsState(daysFromNow(90)));
    summary = await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    expect(summary.resolved).toEqual([`tls-expiry-critical:${DOMAIN_A}`]);
    expect(store.activeEvents(WORKSPACE_A, DOMAIN_A)).toHaveLength(0);
  });

  it('creates nothing when TLS validity evidence is missing', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [
      rule('TLS_EXPIRY_CRITICAL', { severity: 'CRITICAL', thresholdDays: 7 }),
      rule('TLS_EXPIRY_WARNING', { severity: 'WARNING', thresholdDays: 14 }),
    ]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, tlsState(null));
    const summary = await evaluator(store).evaluateAfterRun(run, result('PARTIAL'), null);
    expect(summary).toEqual({ opened: [], resolved: [], touched: [] });
    expect(store.events).toHaveLength(0);
  });
});

describe('alert evaluator repeated retrieval failure', () => {
  const failureRule = () =>
    rule('RETRIEVAL_FAILURE_REPEATED', { severity: 'CRITICAL', thresholdCount: 3 });

  it('opens when a FAILED run reaches the streak threshold', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [failureRule()]);
    store.seedTargetFailures(WORKSPACE_A, TARGET_A, 3);
    const summary = await evaluator(store).evaluateAfterRun(run, result('FAILED'), null);
    expect(summary.opened).toEqual([`retrieval-failure:${DOMAIN_A}`]);
    const active = store.activeEvents(WORKSPACE_A, DOMAIN_A);
    expect(active[0]).toMatchObject({
      severity: 'CRITICAL',
      title: 'Repeated metadata retrieval failures',
    });
    expect(active[0]?.evidence).toMatchObject({
      consecutiveFailures: 3,
      runStatus: 'FAILED',
      thresholdCount: 3,
    });
  });

  it('creates nothing below the threshold', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [failureRule()]);
    store.seedTargetFailures(WORKSPACE_A, TARGET_A, 2);
    const summary = await evaluator(store).evaluateAfterRun(run, result('FAILED'), null);
    expect(summary).toEqual({ opened: [], resolved: [], touched: [] });
  });

  it('updates the same event on repeated failures', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [failureRule()]);
    store.seedTargetFailures(WORKSPACE_A, TARGET_A, 4);
    await evaluator(store).evaluateAfterRun(run, result('FAILED'), null);
    const second = await evaluator(store).evaluateAfterRun(run, result('FAILED'), null);
    expect(second.touched).toEqual([`retrieval-failure:${DOMAIN_A}`]);
    const active = store.activeEvents(WORKSPACE_A, DOMAIN_A);
    expect(active).toHaveLength(1);
    expect(active[0]?.occurrenceCount).toBe(2);
  });

  it('never opens on PARTIAL alone', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [failureRule()]);
    store.seedTargetFailures(WORKSPACE_A, TARGET_A, 9);
    const summary = await evaluator(store).evaluateAfterRun(run, result('PARTIAL'), null);
    expect(summary).toEqual({ opened: [], resolved: [], touched: [] });
    expect(store.events).toHaveLength(0);
  });

  it('touches an active failure event on PARTIAL without duplicating', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [failureRule()]);
    store.seedTargetFailures(WORKSPACE_A, TARGET_A, 5);
    store.seedEvent({
      ackedAt: null,
      dedupeKey: `retrieval-failure:${DOMAIN_A}`,
      detail: 'failures',
      domainId: DOMAIN_A,
      evidence: {},
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      occurrenceCount: 1,
      resolvedAt: null,
      ruleId: 'rule-retrieval_failure_repeated',
      severity: 'CRITICAL',
      status: 'OPEN',
      targetId: TARGET_A,
      title: 'Repeated metadata retrieval failures',
      workspaceId: WORKSPACE_A,
    });
    const summary = await evaluator(store).evaluateAfterRun(run, result('PARTIAL'), null);
    expect(summary.touched).toEqual([`retrieval-failure:${DOMAIN_A}`]);
    expect(store.activeEvents(WORKSPACE_A, DOMAIN_A)).toHaveLength(1);
  });

  it('leaves an active failure event untouched when FAILED below threshold', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [failureRule()]);
    store.seedTargetFailures(WORKSPACE_A, TARGET_A, 1);
    store.seedEvent({
      ackedAt: null,
      dedupeKey: `retrieval-failure:${DOMAIN_A}`,
      detail: 'failures',
      domainId: DOMAIN_A,
      evidence: {},
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      occurrenceCount: 1,
      resolvedAt: null,
      ruleId: 'rule-retrieval_failure_repeated',
      severity: 'CRITICAL',
      status: 'OPEN',
      targetId: TARGET_A,
      title: 'Repeated metadata retrieval failures',
      workspaceId: WORKSPACE_A,
    });
    const summary = await evaluator(store).evaluateAfterRun(run, result('FAILED'), null);
    expect(summary).toEqual({ opened: [], resolved: [], touched: [] });
  });

  it('resolves on a later successful run', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [failureRule()]);
    store.seedTargetFailures(WORKSPACE_A, TARGET_A, 0);
    store.seedEvent({
      ackedAt: null,
      dedupeKey: `retrieval-failure:${DOMAIN_A}`,
      detail: 'failures',
      domainId: DOMAIN_A,
      evidence: {},
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      occurrenceCount: 3,
      resolvedAt: null,
      ruleId: 'rule-retrieval_failure_repeated',
      severity: 'CRITICAL',
      status: 'OPEN',
      targetId: TARGET_A,
      title: 'Repeated metadata retrieval failures',
      workspaceId: WORKSPACE_A,
    });
    const summary = await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    expect(summary.resolved).toEqual([`retrieval-failure:${DOMAIN_A}`]);
  });

  it('does nothing without an enabled rule', async () => {
    const store = new InMemoryAlertStore();
    store.seedTargetFailures(WORKSPACE_A, TARGET_A, 9);
    const summary = await evaluator(store).evaluateAfterRun(run, result('FAILED'), null);
    expect(summary).toEqual({ opened: [], resolved: [], touched: [] });
  });
});

describe('alert evaluator DNS_CHANGED', () => {
  const first = dnsSnapshot();
  const changed = dnsSnapshot({ aRecords: ['93.184.216.35'] });

  function baselineOf(snapshot: AlertDnsSnapshot): ChangeBaseline {
    return { dnsFingerprint: dnsFingerprint(snapshot), tlsFingerprint: null };
  }

  it('establishes a baseline on first observation without alerting', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [rule('DNS_CHANGED', { severity: 'WARNING' })]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, dnsSnapshots(first));
    const summary = await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    expect(summary).toEqual({ opened: [], resolved: [], touched: [] });
  });

  it('does not alert on an identical observation', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [rule('DNS_CHANGED', { severity: 'WARNING' })]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, dnsSnapshots(first));
    const summary = await evaluator(store).evaluateAfterRun(
      run,
      result('SUCCESS'),
      baselineOf(first),
    );
    expect(summary).toEqual({ opened: [], resolved: [], touched: [] });
  });

  it('opens when the usable snapshot differs from the baseline', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [rule('DNS_CHANGED', { severity: 'WARNING' })]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, dnsSnapshots(changed));
    const summary = await evaluator(store).evaluateAfterRun(
      run,
      result('SUCCESS'),
      baselineOf(first),
    );
    expect(summary.opened).toEqual([`dns-changed:${DOMAIN_A}`]);
    const active = store.activeEvents(WORKSPACE_A, DOMAIN_A);
    expect(active[0]).toMatchObject({ title: 'DNS metadata changed' });
    expect(active[0]?.evidence).toMatchObject({ ruleKey: 'DNS_CHANGED' });
  });

  it('does not duplicate on repeated identical changed evidence', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [rule('DNS_CHANGED', { severity: 'WARNING' })]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, dnsSnapshots(changed));
    await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), baselineOf(first));
    const second = await evaluator(store).evaluateAfterRun(
      run,
      result('SUCCESS'),
      baselineOf(first),
    );
    expect(second.touched).toEqual([`dns-changed:${DOMAIN_A}`]);
    expect(store.activeEvents(WORKSPACE_A, DOMAIN_A)).toHaveLength(1);
  });

  it('resolves when fingerprints match again', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [rule('DNS_CHANGED', { severity: 'WARNING' })]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, dnsSnapshots(first));
    store.seedEvent({
      ackedAt: null,
      dedupeKey: `dns-changed:${DOMAIN_A}`,
      detail: 'changed',
      domainId: DOMAIN_A,
      evidence: {},
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      occurrenceCount: 1,
      resolvedAt: null,
      ruleId: 'rule-dns_changed',
      severity: 'WARNING',
      status: 'OPEN',
      targetId: TARGET_A,
      title: 'DNS metadata changed',
      workspaceId: WORKSPACE_A,
    });
    const summary = await evaluator(store).evaluateAfterRun(
      run,
      result('SUCCESS'),
      baselineOf(first),
    );
    expect(summary.resolved).toEqual([`dns-changed:${DOMAIN_A}`]);
  });

  it('creates no false alert on failed retrieval', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [rule('DNS_CHANGED', { severity: 'WARNING' })]);
    store.seedSnapshots(
      WORKSPACE_A,
      DOMAIN_A,
      dnsSnapshots(dnsSnapshot({ lastAttemptStatus: 'FAILED' })),
    );
    const summary = await evaluator(store).evaluateAfterRun(
      run,
      result('FAILED'),
      baselineOf(first),
    );
    expect(summary).toEqual({ opened: [], resolved: [], touched: [] });
  });

  it('leaves an active change alert untouched on failed retrieval', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [rule('DNS_CHANGED', { severity: 'WARNING' })]);
    store.seedSnapshots(
      WORKSPACE_A,
      DOMAIN_A,
      dnsSnapshots(dnsSnapshot({ lastAttemptStatus: 'FAILED' })),
    );
    store.seedEvent({
      ackedAt: null,
      dedupeKey: `dns-changed:${DOMAIN_A}`,
      detail: 'changed',
      domainId: DOMAIN_A,
      evidence: {},
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      occurrenceCount: 1,
      resolvedAt: null,
      ruleId: 'rule-dns_changed',
      severity: 'WARNING',
      status: 'OPEN',
      targetId: TARGET_A,
      title: 'DNS metadata changed',
      workspaceId: WORKSPACE_A,
    });
    const summary = await evaluator(store).evaluateAfterRun(
      run,
      result('FAILED'),
      baselineOf(first),
    );
    expect(summary).toEqual({ opened: [], resolved: [], touched: [] });
    expect(store.activeEvents(WORKSPACE_A, DOMAIN_A)).toHaveLength(1);
  });
});

describe('alert evaluator CERT_CHANGED', () => {
  const firstCert = tlsSnapshot();
  const changedCert = tlsSnapshot({ serialNumber: 'FF:00' });

  function baselineOf(snapshot: AlertTlsSnapshot): ChangeBaseline {
    return { dnsFingerprint: null, tlsFingerprint: tlsFingerprint(snapshot) };
  }

  it('covers first observation, identical, changed, stable, and failure cases', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [rule('CERT_CHANGED', { severity: 'WARNING' })]);

    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, tlsSnapshots(firstCert));
    let summary = await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    expect(summary).toEqual({ opened: [], resolved: [], touched: [] });

    summary = await evaluator(store).evaluateAfterRun(
      run,
      result('SUCCESS'),
      baselineOf(firstCert),
    );
    expect(summary).toEqual({ opened: [], resolved: [], touched: [] });

    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, tlsSnapshots(changedCert));
    summary = await evaluator(store).evaluateAfterRun(
      run,
      result('SUCCESS'),
      baselineOf(firstCert),
    );
    expect(summary.opened).toEqual([`cert-changed:${DOMAIN_A}`]);
    expect(store.activeEvents(WORKSPACE_A, DOMAIN_A)).toHaveLength(1);

    const repeated = await evaluator(store).evaluateAfterRun(
      run,
      result('SUCCESS'),
      baselineOf(firstCert),
    );
    expect(repeated.touched).toEqual([`cert-changed:${DOMAIN_A}`]);
    expect(store.activeEvents(WORKSPACE_A, DOMAIN_A)).toHaveLength(1);

    summary = await evaluator(store).evaluateAfterRun(
      run,
      result('SUCCESS'),
      baselineOf(changedCert),
    );
    expect(summary.resolved).toEqual([`cert-changed:${DOMAIN_A}`]);

    store.seedSnapshots(
      WORKSPACE_A,
      DOMAIN_A,
      tlsSnapshots(tlsSnapshot({ lastAttemptStatus: 'FAILED' })),
    );
    summary = await evaluator(store).evaluateAfterRun(
      run,
      result('FAILED'),
      baselineOf(firstCert),
    );
    expect(summary).toEqual({ opened: [], resolved: [], touched: [] });
  });
});

describe('alert evaluator lifecycle', () => {
  it('keeps ACKNOWLEDGED events acknowledged while the condition holds', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [
      rule('DOMAIN_EXPIRY_WARNING', { severity: 'WARNING', thresholdDays: 14 }),
    ]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, rdapSnapshots(daysFromNow(10)));
    store.seedEvent({
      ackedAt: NOW,
      dedupeKey: `domain-expiry-warning:${DOMAIN_A}`,
      detail: 'warning',
      domainId: DOMAIN_A,
      evidence: {},
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      occurrenceCount: 1,
      resolvedAt: null,
      ruleId: 'rule-domain_expiry_warning',
      severity: 'WARNING',
      status: 'ACKNOWLEDGED',
      targetId: TARGET_A,
      title: 'Domain expiry threshold reached',
      workspaceId: WORKSPACE_A,
    });
    const summary = await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    expect(summary.touched).toEqual([`domain-expiry-warning:${DOMAIN_A}`]);
    expect(summary.opened).toEqual([]);
    const active = store.activeEvents(WORKSPACE_A, DOMAIN_A);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ occurrenceCount: 2, status: 'ACKNOWLEDGED' });
  });

  it('opens a NEW event after a prior event resolved and never reopens the old one', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [
      rule('DOMAIN_EXPIRY_WARNING', { severity: 'WARNING', thresholdDays: 14 }),
    ]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, rdapSnapshots(daysFromNow(10)));
    const resolvedId = store.seedEvent({
      ackedAt: null,
      dedupeKey: `domain-expiry-warning:${DOMAIN_A}`,
      detail: 'warning',
      domainId: DOMAIN_A,
      evidence: {},
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      occurrenceCount: 4,
      resolvedAt: NOW,
      ruleId: 'rule-domain_expiry_warning',
      severity: 'WARNING',
      status: 'RESOLVED',
      targetId: TARGET_A,
      title: 'Domain expiry threshold reached',
      workspaceId: WORKSPACE_A,
    });
    const summary = await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    expect(summary.opened).toEqual([`domain-expiry-warning:${DOMAIN_A}`]);
    const matching = store.events.filter(
      (event) => event.dedupeKey === `domain-expiry-warning:${DOMAIN_A}`,
    );
    expect(matching).toHaveLength(2);
    const old = matching.find((event) => event.id === resolvedId);
    expect(old).toMatchObject({ occurrenceCount: 4, status: 'RESOLVED' });
    const fresh = matching.find((event) => event.id !== resolvedId);
    expect(fresh).toMatchObject({ occurrenceCount: 1, status: 'OPEN' });
  });

  it('is idempotent under repeated evaluation', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [
      rule('DOMAIN_EXPIRY_WARNING', { severity: 'WARNING', thresholdDays: 14 }),
    ]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, rdapSnapshots(daysFromNow(10)));
    await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    const active = store.activeEvents(WORKSPACE_A, DOMAIN_A);
    expect(active).toHaveLength(1);
    expect(active[0]?.occurrenceCount).toBe(2);
  });
});

describe('alert evaluator concurrency', () => {
  it('does not create duplicate active events under concurrent evaluation', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [rule('DNS_CHANGED', { severity: 'WARNING' })]);
    const firstSnap = dnsSnapshot();
    const changedSnap = dnsSnapshot({ aRecords: ['93.184.216.35'] });
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, dnsSnapshots(changedSnap));
    const baseline: ChangeBaseline = {
      dnsFingerprint: dnsFingerprint(firstSnap),
      tlsFingerprint: null,
    };
    const engine = evaluator(store);
    const [firstSummary, secondSummary] = await Promise.all([
      engine.evaluateAfterRun(run, result('SUCCESS'), baseline),
      engine.evaluateAfterRun(run, result('SUCCESS'), baseline),
    ]);
    const opened = [...firstSummary.opened, ...secondSummary.opened];
    const touched = [...firstSummary.touched, ...secondSummary.touched];
    expect(opened).toEqual([`dns-changed:${DOMAIN_A}`]);
    expect(touched).toEqual([`dns-changed:${DOMAIN_A}`]);
    const active = store.activeEvents(WORKSPACE_A, DOMAIN_A);
    expect(active).toHaveLength(1);
    expect(active[0]?.occurrenceCount).toBe(2);
  });

  it('recovers from a unique-conflict race by touching the winner', async () => {
    class RaceStore extends InMemoryAlertStore {
      override async loadEvaluationState(
        workspaceId: string,
        domainId: string,
        targetId: string,
      ) {
        const state = await super.loadEvaluationState(workspaceId, domainId, targetId);
        return { ...state, activeEvents: [] };
      }
    }
    const store = new RaceStore();
    store.seedRules(WORKSPACE_A, [rule('DNS_CHANGED', { severity: 'WARNING' })]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, dnsSnapshots(dnsSnapshot()));
    store.seedEvent({
      ackedAt: null,
      dedupeKey: `dns-changed:${DOMAIN_A}`,
      detail: 'changed',
      domainId: DOMAIN_A,
      evidence: {},
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      occurrenceCount: 1,
      resolvedAt: null,
      ruleId: 'rule-dns_changed',
      severity: 'WARNING',
      status: 'OPEN',
      targetId: TARGET_A,
      title: 'DNS metadata changed',
      workspaceId: WORKSPACE_A,
    });
    store.failNextInsert = true;
    const summary = await evaluator(store).evaluateAfterRun(
      run,
      result('SUCCESS'),
      { dnsFingerprint: 'previous-fingerprint', tlsFingerprint: null },
    );
    expect(summary.opened).toEqual([]);
    expect(summary.touched).toEqual([`dns-changed:${DOMAIN_A}`]);
    expect(store.activeEvents(WORKSPACE_A, DOMAIN_A)).toHaveLength(1);
  });
});

describe('alert evaluator workspace isolation', () => {
  it('scopes every store access to the run workspace', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [
      rule('DOMAIN_EXPIRY_WARNING', { severity: 'WARNING', thresholdDays: 14 }),
    ]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, rdapSnapshots(daysFromNow(10)));
    await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    expect(store.calls.length).toBeGreaterThan(0);
    for (const call of store.calls) {
      expect(call.workspaceId).toBe(WORKSPACE_A);
    }
  });

  it('never touches another workspace alert data', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [
      rule('DOMAIN_EXPIRY_WARNING', { severity: 'WARNING', thresholdDays: 14 }),
    ]);
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, rdapSnapshots(daysFromNow(10)));
    store.seedEvent({
      ackedAt: null,
      dedupeKey: `domain-expiry-warning:${DOMAIN_A}`,
      detail: 'other workspace',
      domainId: DOMAIN_A,
      evidence: {},
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      occurrenceCount: 1,
      resolvedAt: null,
      ruleId: 'rule-other',
      severity: 'WARNING',
      status: 'OPEN',
      targetId: TARGET_A,
      title: 'Domain expiry threshold reached',
      workspaceId: WORKSPACE_B,
    });
    await evaluator(store).evaluateAfterRun(run, result('SUCCESS'), null);
    const other = store.events.find((event) => event.workspaceId === WORKSPACE_B);
    expect(other).toMatchObject({ occurrenceCount: 1, status: 'OPEN' });
    expect(store.activeEvents(WORKSPACE_A, DOMAIN_A)).toHaveLength(1);
  });
});

describe('alert evaluator safe content', () => {
  it('persists only safe evidence and truthful wording', async () => {
    const store = new InMemoryAlertStore();
    store.seedRules(WORKSPACE_A, [rule('DNS_CHANGED', { severity: 'WARNING' })]);
    const changedSnap = dnsSnapshot({ aRecords: ['93.184.216.35'] });
    store.seedSnapshots(WORKSPACE_A, DOMAIN_A, dnsSnapshots(changedSnap));
    await evaluator(store).evaluateAfterRun(
      run,
      result('SUCCESS'),
      { dnsFingerprint: dnsFingerprint(dnsSnapshot()), tlsFingerprint: null },
    );
    const active = store.activeEvents(WORKSPACE_A, DOMAIN_A);
    expect(active).toHaveLength(1);
    const evidence = active[0]?.evidence ?? {};
    expect(Object.keys(evidence).sort()).toEqual([
      'currentFingerprint',
      'evaluatedAt',
      'previousFingerprint',
      'ruleKey',
    ]);
    const serialized = JSON.stringify({ evidence, title: active[0]?.title, detail: active[0]?.detail });
    expect(serialized).not.toContain('93.184.216.35');
    for (const forbidden of ['unhealthy', 'Website down', 'offline', 'compromised']) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
