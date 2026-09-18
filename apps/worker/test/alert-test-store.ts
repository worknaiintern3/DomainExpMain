/* eslint-disable @typescript-eslint/require-await */
import { AlertActiveConflictError } from '../src/alerts/alert.types';
import type {
  ActiveAlertEventState,
  AlertEvaluationState,
  AlertEventInput,
  AlertRuleState,
  AlertSnapshotState,
  AlertStore,
} from '../src/alerts/alert.types';

export type StoredEventStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface StoredTestEvent {
  ackedAt: Date | null;
  dedupeKey: string;
  detail: string;
  domainId: string;
  evidence: Record<string, unknown>;
  firstSeenAt: Date;
  id: string;
  lastSeenAt: Date;
  occurrenceCount: number;
  resolvedAt: Date | null;
  ruleId: string;
  severity: string;
  status: StoredEventStatus;
  targetId: string;
  title: string;
  workspaceId: string;
}

export class InMemoryAlertStore implements AlertStore {
  readonly calls: { method: string; workspaceId: string }[] = [];
  readonly events: StoredTestEvent[] = [];
  failNextInsert = false;
  private eventSequence = 0;
  private readonly rulesByWorkspace = new Map<string, AlertRuleState[]>();
  private readonly snapshotsByDomain = new Map<string, AlertSnapshotState>();
  private readonly failuresByTarget = new Map<string, number>();

  seedRules(workspaceId: string, rules: readonly AlertRuleState[]): void {
    this.rulesByWorkspace.set(workspaceId, [...rules]);
  }

  seedSnapshots(
    workspaceId: string,
    domainId: string,
    snapshots: AlertSnapshotState,
  ): void {
    this.snapshotsByDomain.set(`${workspaceId}:${domainId}`, snapshots);
  }

  seedTargetFailures(
    workspaceId: string,
    targetId: string,
    consecutiveFailures: number,
  ): void {
    this.failuresByTarget.set(`${workspaceId}:${targetId}`, consecutiveFailures);
  }

  seedEvent(event: Omit<StoredTestEvent, 'id'> & { id?: string }): string {
    this.eventSequence += 1;
    const id = event.id ?? `test-event-${String(this.eventSequence)}`;
    this.events.push({ ...event, id });
    return id;
  }

  activeEvents(workspaceId: string, domainId: string): StoredTestEvent[] {
    return this.events.filter(
      (event) =>
        event.workspaceId === workspaceId &&
        event.domainId === domainId &&
        (event.status === 'OPEN' || event.status === 'ACKNOWLEDGED'),
    );
  }

  async readSnapshots(
    workspaceId: string,
    domainId: string,
  ): Promise<AlertSnapshotState> {
    this.calls.push({ method: 'readSnapshots', workspaceId });
    return (
      this.snapshotsByDomain.get(`${workspaceId}:${domainId}`) ?? {
        dns: null,
        rdap: null,
        tls: null,
      }
    );
  }

  async loadEvaluationState(
    workspaceId: string,
    domainId: string,
    targetId: string,
  ): Promise<AlertEvaluationState> {
    this.calls.push({ method: 'loadEvaluationState', workspaceId });
    return {
      activeEvents: this.toActive(workspaceId, domainId),
      consecutiveFailures:
        this.failuresByTarget.get(`${workspaceId}:${targetId}`) ?? null,
      rules: this.rulesByWorkspace.get(workspaceId) ?? [],
      snapshots: await this.readSnapshots(workspaceId, domainId),
    };
  }

  async readActiveEvents(
    workspaceId: string,
    domainId: string,
  ): Promise<readonly ActiveAlertEventState[]> {
    this.calls.push({ method: 'readActiveEvents', workspaceId });
    return this.toActive(workspaceId, domainId);
  }

  async insertEvent(event: AlertEventInput): Promise<void> {
    this.calls.push({ method: 'insertEvent', workspaceId: event.workspaceId });
    if (this.failNextInsert) {
      this.failNextInsert = false;
      throw new AlertActiveConflictError(event.dedupeKey);
    }
    const conflict = this.events.some(
      (existing) =>
        existing.workspaceId === event.workspaceId &&
        existing.dedupeKey === event.dedupeKey &&
        (existing.status === 'OPEN' || existing.status === 'ACKNOWLEDGED'),
    );
    if (conflict) throw new AlertActiveConflictError(event.dedupeKey);
    this.eventSequence += 1;
    this.events.push({
      ackedAt: null,
      dedupeKey: event.dedupeKey,
      detail: event.detail,
      domainId: event.domainId,
      evidence: event.evidence,
      firstSeenAt: event.now,
      id: `test-event-${String(this.eventSequence)}`,
      lastSeenAt: event.now,
      occurrenceCount: 1,
      resolvedAt: null,
      ruleId: event.ruleId,
      severity: event.severity,
      status: 'OPEN',
      targetId: event.targetId,
      title: event.title,
      workspaceId: event.workspaceId,
    });
  }

  async touchEvent(
    workspaceId: string,
    eventId: string,
    evidence: Record<string, unknown>,
    now: Date,
  ): Promise<void> {
    this.calls.push({ method: 'touchEvent', workspaceId });
    const event = this.events.find(
      (candidate) =>
        candidate.workspaceId === workspaceId &&
        candidate.id === eventId &&
        (candidate.status === 'OPEN' || candidate.status === 'ACKNOWLEDGED'),
    );
    if (!event) return;
    event.evidence = evidence;
    event.lastSeenAt = now;
    event.occurrenceCount += 1;
  }

  async resolveByDedupe(
    workspaceId: string,
    dedupeKey: string,
    now: Date,
  ): Promise<void> {
    this.calls.push({ method: 'resolveByDedupe', workspaceId });
    for (const event of this.events) {
      if (
        event.workspaceId === workspaceId &&
        event.dedupeKey === dedupeKey &&
        (event.status === 'OPEN' || event.status === 'ACKNOWLEDGED')
      ) {
        event.status = 'RESOLVED';
        event.resolvedAt = now;
      }
    }
  }

  private toActive(
    workspaceId: string,
    domainId: string,
  ): ActiveAlertEventState[] {
    const active: ActiveAlertEventState[] = [];
    for (const event of this.activeEvents(workspaceId, domainId)) {
      if (event.status !== 'OPEN' && event.status !== 'ACKNOWLEDGED') continue;
      active.push({
        dedupeKey: event.dedupeKey,
        id: event.id,
        status: event.status,
      });
    }
    return active;
  }
}
