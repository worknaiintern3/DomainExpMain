import type {
  ClaimedMonitoringRun,
  MonitoringExecutionResult,
} from '../monitoring/monitoring.types';
import {
  daysUntil,
  dnsFingerprint,
  shortFingerprint,
  tlsFingerprint,
} from './alert-fingerprint';
import { AlertActiveConflictError } from './alert.types';
import type {
  AlertEvaluationHooks,
  AlertEvaluationState,
  AlertEvaluationSummary,
  AlertEvaluatorClock,
  AlertRuleKey,
  AlertRuleState,
  AlertStore,
  ChangeBaseline,
} from './alert.types';

const systemClock: AlertEvaluatorClock = { now: () => new Date() };

interface ExpiryRuleConfig {
  readonly criticalKey: AlertRuleKey;
  readonly dedupePrefix: string;
  readonly expiryAt: Date | null;
  readonly title: string;
  readonly usable: boolean;
  readonly warningKey: AlertRuleKey;
}

/**
 * Phase 9D alert evaluation engine.
 *
 * DB-only: performs no network calls. All tenant reads/writes go through the
 * injected AlertStore, whose Postgres implementation scopes every operation
 * with withWorkspaceContext(workspaceId).
 *
 * Exact rule semantics:
 * - Only enabled rules belonging to the run's workspace are evaluated. A
 *   missing rule row, a disabled rule, or a missing rule-configured threshold
 *   skips that rule entirely (no open, no touch, no resolve).
 * - Domain/TLS expiry use the last usable persisted snapshot only. RDAP
 *   usable means retrievedAt + expiresAt are present; TLS usable means
 *   retrievedAt + validTo are present. A preserved snapshot after a failed
 *   retrieval is still evaluated. Missing expiry evidence skips the rule
 *   without opening or resolving anything.
 * - CRITICAL (daysRemaining <= critical threshold) supersedes WARNING.
 *   WARNING is active only at or below its threshold AND outside the critical
 *   range. Evidence safely outside both thresholds resolves active alerts.
 * - RETRIEVAL_FAILURE_REPEATED opens only when the latest terminal run is
 *   FAILED and the Phase 9C consecutive non-success streak
 *   (monitoring_targets.consecutiveFailures, reset on SUCCESS and incremented
 *   on PARTIAL/FAILED) reaches the rule threshold. PARTIAL alone never opens;
 *   it touches an already-active event. SUCCESS resolves. FAILED below the
 *   threshold leaves existing state untouched.
 * - DNS_CHANGED / CERT_CHANGED compare the pre-run usable fingerprint
 *   baseline (captured before Phase 8 persistence overwrites the latest
 *   snapshot) against the current usable snapshot. Both must exist and
 *   differ. First observation establishes the baseline with no alert.
 *   Retrieval failure (last attempt FAILED, preserved snapshot) skips change
 *   evaluation so failures neither open nor resolve change alerts.
 */
export class AlertEvaluator implements AlertEvaluationHooks {
  constructor(
    private readonly store: AlertStore,
    private readonly clock: AlertEvaluatorClock = systemClock,
  ) {}

  async captureBaseline(
    run: ClaimedMonitoringRun,
  ): Promise<ChangeBaseline | null> {
    const snapshots = await this.store.readSnapshots(
      run.workspaceId,
      run.domainId,
    );
    return {
      dnsFingerprint: snapshots.dns ? dnsFingerprint(snapshots.dns) : null,
      tlsFingerprint: snapshots.tls ? tlsFingerprint(snapshots.tls) : null,
    };
  }

  /**
   * Evaluates all enabled workspace rules for one terminal monitoring run.
   * Callers must only pass terminal results; MonitoringExecutionResult is
   * terminal by type and the worker invokes this after a successful finalize.
   */
  async evaluateAfterRun(
    run: ClaimedMonitoringRun,
    result: MonitoringExecutionResult,
    baseline: ChangeBaseline | null,
  ): Promise<AlertEvaluationSummary> {
    const summary: AlertEvaluationSummary = {
      opened: [],
      resolved: [],
      touched: [],
    };
    const now = this.clock.now();
    const state = await this.store.loadEvaluationState(
      run.workspaceId,
      run.domainId,
      run.targetId,
    );
    const rules = new Map<AlertRuleKey, AlertRuleState>();
    for (const rule of state.rules) {
      if (rule.enabled) rules.set(rule.key, rule);
    }

    await this.evaluateDomainExpiry(run, rules, state, now, summary);
    await this.evaluateTlsExpiry(run, rules, state, now, summary);
    await this.evaluateRetrievalFailures(run, result, rules, state, now, summary);
    await this.evaluateDnsChanged(run, rules, state, baseline, now, summary);
    await this.evaluateCertChanged(run, rules, state, baseline, now, summary);
    return summary;
  }

  private async evaluateDomainExpiry(
    run: ClaimedMonitoringRun,
    rules: ReadonlyMap<AlertRuleKey, AlertRuleState>,
    state: AlertEvaluationState,
    now: Date,
    summary: AlertEvaluationSummary,
  ): Promise<void> {
    await this.evaluateExpiry(run, rules, state, now, summary, {
      criticalKey: 'DOMAIN_EXPIRY_CRITICAL',
      dedupePrefix: 'domain-expiry',
      expiryAt: state.snapshots.rdap?.expiresAt ?? null,
      title: 'Domain expiry threshold reached',
      usable: state.snapshots.rdap !== null,
      warningKey: 'DOMAIN_EXPIRY_WARNING',
    });
  }

  private async evaluateTlsExpiry(
    run: ClaimedMonitoringRun,
    rules: ReadonlyMap<AlertRuleKey, AlertRuleState>,
    state: AlertEvaluationState,
    now: Date,
    summary: AlertEvaluationSummary,
  ): Promise<void> {
    await this.evaluateExpiry(run, rules, state, now, summary, {
      criticalKey: 'TLS_EXPIRY_CRITICAL',
      dedupePrefix: 'tls-expiry',
      expiryAt: state.snapshots.tls?.validTo ?? null,
      title: 'TLS certificate expiry threshold reached',
      usable: state.snapshots.tls !== null,
      warningKey: 'TLS_EXPIRY_WARNING',
    });
  }

  private async evaluateExpiry(
    run: ClaimedMonitoringRun,
    rules: ReadonlyMap<AlertRuleKey, AlertRuleState>,
    state: AlertEvaluationState,
    now: Date,
    summary: AlertEvaluationSummary,
    config: ExpiryRuleConfig,
  ): Promise<void> {
    if (!config.usable || !config.expiryAt) return;
    const daysRemaining = daysUntil(config.expiryAt, now);
    const critical = rules.get(config.criticalKey);
    const warning = rules.get(config.warningKey);
    const criticalThreshold =
      critical && critical.thresholdDays !== null
        ? critical.thresholdDays
        : null;
    const warningThreshold =
      warning && warning.thresholdDays !== null ? warning.thresholdDays : null;
    const criticalActive =
      criticalThreshold !== null && daysRemaining <= criticalThreshold;
    const warningActive =
      warningThreshold !== null &&
      daysRemaining <= warningThreshold &&
      !criticalActive;

    if (critical && criticalThreshold !== null) {
      const dedupeKey = `${config.dedupePrefix}-critical:${run.domainId}`;
      if (criticalActive) {
        await this.openOrTouch(run, critical, state, dedupeKey, config.title,
          this.expiryDetail(daysRemaining, criticalThreshold),
          {
            daysRemaining,
            evaluatedAt: now.toISOString(),
            expiryAt: config.expiryAt.toISOString(),
            ruleKey: config.criticalKey,
            thresholdDays: criticalThreshold,
          },
          now, summary);
      } else {
        await this.resolveIfActive(run, state, dedupeKey, now, summary);
      }
    }

    if (warning && warningThreshold !== null) {
      const dedupeKey = `${config.dedupePrefix}-warning:${run.domainId}`;
      if (warningActive) {
        await this.openOrTouch(run, warning, state, dedupeKey, config.title,
          this.expiryDetail(daysRemaining, warningThreshold),
          {
            daysRemaining,
            evaluatedAt: now.toISOString(),
            expiryAt: config.expiryAt.toISOString(),
            ruleKey: config.warningKey,
            thresholdDays: warningThreshold,
          },
          now, summary);
      } else {
        await this.resolveIfActive(run, state, dedupeKey, now, summary);
      }
    }
  }

  private expiryDetail(daysRemaining: number, thresholdDays: number): string {
    const remaining =
      daysRemaining >= 0
        ? `expires in ${String(daysRemaining)} day(s)`
        : `expired ${String(-daysRemaining)} day(s) ago`;
    return `Threshold reached: resource ${remaining} (threshold ${String(thresholdDays)} day(s)).`;
  }

  private async evaluateRetrievalFailures(
    run: ClaimedMonitoringRun,
    result: MonitoringExecutionResult,
    rules: ReadonlyMap<AlertRuleKey, AlertRuleState>,
    state: AlertEvaluationState,
    now: Date,
    summary: AlertEvaluationSummary,
  ): Promise<void> {
    const rule = rules.get('RETRIEVAL_FAILURE_REPEATED');
    const thresholdCount = rule?.thresholdCount ?? null;
    if (rule === undefined || thresholdCount === null) return;
    const dedupeKey = `retrieval-failure:${run.domainId}`;
    if (result.status === 'SUCCESS') {
      await this.resolveIfActive(run, state, dedupeKey, now, summary);
      return;
    }
    if (result.status === 'PARTIAL') {
      const existing = state.activeEvents.find(
        (event) => event.dedupeKey === dedupeKey,
      );
      if (existing) {
        await this.store.touchEvent(run.workspaceId, existing.id, {
          consecutiveFailures: state.consecutiveFailures,
          evaluatedAt: now.toISOString(),
          ruleKey: 'RETRIEVAL_FAILURE_REPEATED',
          runId: run.runId,
          runStatus: result.status,
          thresholdCount,
        }, now);
        summary.touched.push(dedupeKey);
      }
      return;
    }
    const streak = state.consecutiveFailures ?? 0;
    if (streak < thresholdCount) return;
    await this.openOrTouch(run, rule, state, dedupeKey,
      'Repeated metadata retrieval failures',
      `Monitoring run failed with ${String(streak)} consecutive non-success run(s) (threshold ${String(thresholdCount)}).`,
      {
        consecutiveFailures: streak,
        evaluatedAt: now.toISOString(),
        ruleKey: 'RETRIEVAL_FAILURE_REPEATED',
        runId: run.runId,
        runStatus: result.status,
        thresholdCount,
      },
      now, summary);
  }

  private async evaluateDnsChanged(
    run: ClaimedMonitoringRun,
    rules: ReadonlyMap<AlertRuleKey, AlertRuleState>,
    state: AlertEvaluationState,
    baseline: ChangeBaseline | null,
    now: Date,
    summary: AlertEvaluationSummary,
  ): Promise<void> {
    const rule = rules.get('DNS_CHANGED');
    const current = state.snapshots.dns;
    if (!rule || !current) return;
    if (current.lastAttemptStatus === 'FAILED') return;
    if (!baseline?.dnsFingerprint) return;
    const currentFingerprint = dnsFingerprint(current);
    const dedupeKey = `dns-changed:${run.domainId}`;
    if (currentFingerprint === baseline.dnsFingerprint) {
      await this.resolveIfActive(run, state, dedupeKey, now, summary);
      return;
    }
    await this.openOrTouch(run, rule, state, dedupeKey,
      'DNS metadata changed',
      `Normalized DNS fingerprint changed (previous ${shortFingerprint(baseline.dnsFingerprint)}, current ${shortFingerprint(currentFingerprint)}).`,
      {
        currentFingerprint,
        evaluatedAt: now.toISOString(),
        previousFingerprint: baseline.dnsFingerprint,
        ruleKey: 'DNS_CHANGED',
      },
      now, summary);
  }

  private async evaluateCertChanged(
    run: ClaimedMonitoringRun,
    rules: ReadonlyMap<AlertRuleKey, AlertRuleState>,
    state: AlertEvaluationState,
    baseline: ChangeBaseline | null,
    now: Date,
    summary: AlertEvaluationSummary,
  ): Promise<void> {
    const rule = rules.get('CERT_CHANGED');
    const current = state.snapshots.tls;
    if (!rule || !current) return;
    if (current.lastAttemptStatus === 'FAILED') return;
    if (!baseline?.tlsFingerprint) return;
    const currentFingerprint = tlsFingerprint(current);
    const dedupeKey = `cert-changed:${run.domainId}`;
    if (currentFingerprint === baseline.tlsFingerprint) {
      await this.resolveIfActive(run, state, dedupeKey, now, summary);
      return;
    }
    await this.openOrTouch(run, rule, state, dedupeKey,
      'TLS certificate metadata changed',
      `Normalized TLS certificate fingerprint changed (previous ${shortFingerprint(baseline.tlsFingerprint)}, current ${shortFingerprint(currentFingerprint)}).`,
      {
        currentFingerprint,
        evaluatedAt: now.toISOString(),
        previousFingerprint: baseline.tlsFingerprint,
        ruleKey: 'CERT_CHANGED',
      },
      now, summary);
  }

  private async openOrTouch(
    run: ClaimedMonitoringRun,
    rule: AlertRuleState,
    state: AlertEvaluationState,
    dedupeKey: string,
    title: string,
    detail: string,
    evidence: Record<string, unknown>,
    now: Date,
    summary: AlertEvaluationSummary,
  ): Promise<void> {
    const existing = state.activeEvents.find(
      (event) => event.dedupeKey === dedupeKey,
    );
    if (existing) {
      await this.store.touchEvent(run.workspaceId, existing.id, evidence, now);
      summary.touched.push(dedupeKey);
      return;
    }
    try {
      await this.store.insertEvent({
        dedupeKey,
        detail,
        domainId: run.domainId,
        evidence,
        now,
        ruleId: rule.id,
        severity: rule.severity,
        targetId: run.targetId,
        title,
        workspaceId: run.workspaceId,
      });
      summary.opened.push(dedupeKey);
    } catch (error) {
      if (!(error instanceof AlertActiveConflictError)) throw error;
      const fresh = await this.store.readActiveEvents(
        run.workspaceId,
        run.domainId,
      );
      const raced = fresh.find((event) => event.dedupeKey === dedupeKey);
      if (raced) {
        await this.store.touchEvent(run.workspaceId, raced.id, evidence, now);
        summary.touched.push(dedupeKey);
        return;
      }
      await this.store.insertEvent({
        dedupeKey,
        detail,
        domainId: run.domainId,
        evidence,
        now,
        ruleId: rule.id,
        severity: rule.severity,
        targetId: run.targetId,
        title,
        workspaceId: run.workspaceId,
      });
      summary.opened.push(dedupeKey);
    }
  }

  private async resolveIfActive(
    run: ClaimedMonitoringRun,
    state: AlertEvaluationState,
    dedupeKey: string,
    now: Date,
    summary: AlertEvaluationSummary,
  ): Promise<void> {
    const active = state.activeEvents.some(
      (event) => event.dedupeKey === dedupeKey,
    );
    if (!active) return;
    await this.store.resolveByDedupe(run.workspaceId, dedupeKey, now);
    summary.resolved.push(dedupeKey);
  }
}
