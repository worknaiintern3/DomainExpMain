import {
  alertEvents,
  alertRules,
  domainDnsMetadata,
  domainRdapMetadata,
  domainTlsMetadata,
  monitoringTargets,
  type DomainDnsMetadata,
  type DomainRdapMetadata,
  type DomainTlsMetadata,
  type WorkspaceTransactionHost,
} from '@domainpulse/database';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { AlertActiveConflictError } from './alert.types';
import type {
  ActiveAlertEventState,
  AlertDnsSnapshot,
  AlertEvaluationState,
  AlertEventInput,
  AlertRdapSnapshot,
  AlertRuleState,
  AlertSnapshotState,
  AlertStore,
  AlertTlsSnapshot,
} from './alert.types';

function postgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (typeof current === 'object' && current !== null && !seen.has(current)) {
    seen.add(current);
    const record = current as { cause?: unknown; code?: unknown };
    if (typeof record.code === 'string') return record.code;
    current = record.cause;
  }
  return undefined;
}

function toRdapSnapshot(
  row: DomainRdapMetadata | undefined,
): AlertRdapSnapshot | null {
  if (!row?.retrievedAt) return null;
  return { expiresAt: row.expiresAt, retrievedAt: row.retrievedAt };
}

function toDnsSnapshot(
  row: DomainDnsMetadata | undefined,
): AlertDnsSnapshot | null {
  if (!row?.retrievedAt) return null;
  return {
    aRecords: [...row.aRecords],
    aaaaRecords: [...row.aaaaRecords],
    cnameRecords: [...row.cnameRecords],
    dsRecords: row.dsRecords.map((record) => ({ ...record })),
    lastAttemptStatus: row.lastAttemptStatus,
    mxRecords: row.mxRecords.map((record) => ({ ...record })),
    nsRecords: [...row.nsRecords],
    retrievedAt: row.retrievedAt,
    txtRecordCount: row.txtRecordCount,
  };
}

function toTlsSnapshot(
  row: DomainTlsMetadata | undefined,
): AlertTlsSnapshot | null {
  if (!row?.retrievedAt) return null;
  return {
    fingerprint256: row.fingerprint256,
    issuerCommonName: row.issuerCommonName,
    issuerOrganization: row.issuerOrganization,
    lastAttemptStatus: row.lastAttemptStatus,
    retrievedAt: row.retrievedAt,
    serialNumber: row.serialNumber,
    subjectAltNames: [...row.subjectAltNames],
    subjectCommonName: row.subjectCommonName,
    validFrom: row.validFrom,
    validTo: row.validTo,
  };
}

function toRuleState(row: typeof alertRules.$inferSelect): AlertRuleState {
  return {
    enabled: row.enabled,
    id: row.id,
    key: row.key,
    severity: row.severity,
    thresholdCount: row.thresholdCount,
    thresholdDays: row.thresholdDays,
  };
}

export class PostgresAlertRepository implements AlertStore {
  constructor(private readonly host: WorkspaceTransactionHost) {}

  async readSnapshots(
    workspaceId: string,
    domainId: string,
  ): Promise<AlertSnapshotState> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [rdapRows, dnsRows, tlsRows] = await Promise.all([
        transaction
          .select()
          .from(domainRdapMetadata)
          .where(
            and(
              eq(domainRdapMetadata.workspaceId, workspaceId),
              eq(domainRdapMetadata.domainId, domainId),
            ),
          )
          .limit(1),
        transaction
          .select()
          .from(domainDnsMetadata)
          .where(
            and(
              eq(domainDnsMetadata.workspaceId, workspaceId),
              eq(domainDnsMetadata.domainId, domainId),
            ),
          )
          .limit(1),
        transaction
          .select()
          .from(domainTlsMetadata)
          .where(
            and(
              eq(domainTlsMetadata.workspaceId, workspaceId),
              eq(domainTlsMetadata.domainId, domainId),
            ),
          )
          .limit(1),
      ]);
      return {
        dns: toDnsSnapshot(dnsRows[0]),
        rdap: toRdapSnapshot(rdapRows[0]),
        tls: toTlsSnapshot(tlsRows[0]),
      };
    });
  }

  async loadEvaluationState(
    workspaceId: string,
    domainId: string,
    targetId: string,
  ): Promise<AlertEvaluationState> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const [ruleRows, rdapRows, dnsRows, tlsRows, targetRows, eventRows] =
        await Promise.all([
          transaction
            .select()
            .from(alertRules)
            .where(eq(alertRules.workspaceId, workspaceId)),
          transaction
            .select()
            .from(domainRdapMetadata)
            .where(
              and(
                eq(domainRdapMetadata.workspaceId, workspaceId),
                eq(domainRdapMetadata.domainId, domainId),
              ),
            )
            .limit(1),
          transaction
            .select()
            .from(domainDnsMetadata)
            .where(
              and(
                eq(domainDnsMetadata.workspaceId, workspaceId),
                eq(domainDnsMetadata.domainId, domainId),
              ),
            )
            .limit(1),
          transaction
            .select()
            .from(domainTlsMetadata)
            .where(
              and(
                eq(domainTlsMetadata.workspaceId, workspaceId),
                eq(domainTlsMetadata.domainId, domainId),
              ),
            )
            .limit(1),
          transaction
            .select({ consecutiveFailures: monitoringTargets.consecutiveFailures })
            .from(monitoringTargets)
            .where(
              and(
                eq(monitoringTargets.workspaceId, workspaceId),
                eq(monitoringTargets.id, targetId),
              ),
            )
            .limit(1),
          transaction
            .select({
              dedupeKey: alertEvents.dedupeKey,
              id: alertEvents.id,
              status: alertEvents.status,
            })
            .from(alertEvents)
            .where(
              and(
                eq(alertEvents.workspaceId, workspaceId),
                eq(alertEvents.domainId, domainId),
                inArray(alertEvents.status, ['OPEN', 'ACKNOWLEDGED']),
              ),
            ),
        ]);
      const activeEvents: ActiveAlertEventState[] = [];
      for (const row of eventRows) {
        if (row.status === 'OPEN' || row.status === 'ACKNOWLEDGED') {
          activeEvents.push({
            dedupeKey: row.dedupeKey,
            id: row.id,
            status: row.status,
          });
        }
      }
      return {
        activeEvents,
        consecutiveFailures: targetRows[0]?.consecutiveFailures ?? null,
        rules: ruleRows.map(toRuleState),
        snapshots: {
          dns: toDnsSnapshot(dnsRows[0]),
          rdap: toRdapSnapshot(rdapRows[0]),
          tls: toTlsSnapshot(tlsRows[0]),
        },
      };
    });
  }

  async readActiveEvents(
    workspaceId: string,
    domainId: string,
  ): Promise<readonly ActiveAlertEventState[]> {
    return await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      const rows = await transaction
        .select({
          dedupeKey: alertEvents.dedupeKey,
          id: alertEvents.id,
          status: alertEvents.status,
        })
        .from(alertEvents)
        .where(
          and(
            eq(alertEvents.workspaceId, workspaceId),
            eq(alertEvents.domainId, domainId),
            inArray(alertEvents.status, ['OPEN', 'ACKNOWLEDGED']),
          ),
        );
      const active: ActiveAlertEventState[] = [];
      for (const row of rows) {
        if (row.status === 'OPEN' || row.status === 'ACKNOWLEDGED') {
          active.push({ dedupeKey: row.dedupeKey, id: row.id, status: row.status });
        }
      }
      return active;
    });
  }

  async insertEvent(event: AlertEventInput): Promise<void> {
    try {
      await this.host.withWorkspaceContext(event.workspaceId, async (transaction) => {
        await transaction.insert(alertEvents).values({
          dedupeKey: event.dedupeKey,
          detail: event.detail,
          domainId: event.domainId,
          evidence: event.evidence,
          ruleId: event.ruleId,
          severity: event.severity,
          status: 'OPEN' as const,
          targetId: event.targetId,
          title: event.title,
          workspaceId: event.workspaceId,
        });
      });
    } catch (error) {
      if (postgresErrorCode(error) === '23505') {
        throw new AlertActiveConflictError(event.dedupeKey);
      }
      throw error;
    }
  }

  async touchEvent(
    workspaceId: string,
    eventId: string,
    evidence: Record<string, unknown>,
    now: Date,
  ): Promise<void> {
    await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      await transaction
        .update(alertEvents)
        .set({
          evidence,
          lastSeenAt: now,
          occurrenceCount: sql`${alertEvents.occurrenceCount} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(alertEvents.workspaceId, workspaceId),
            eq(alertEvents.id, eventId),
            inArray(alertEvents.status, ['OPEN', 'ACKNOWLEDGED']),
          ),
        );
    });
  }

  async resolveByDedupe(
    workspaceId: string,
    dedupeKey: string,
    now: Date,
  ): Promise<void> {
    await this.host.withWorkspaceContext(workspaceId, async (transaction) => {
      await transaction
        .update(alertEvents)
        .set({
          resolvedAt: now,
          status: 'RESOLVED' as const,
          updatedAt: now,
        })
        .where(
          and(
            eq(alertEvents.workspaceId, workspaceId),
            eq(alertEvents.dedupeKey, dedupeKey),
            inArray(alertEvents.status, ['OPEN', 'ACKNOWLEDGED']),
          ),
        );
    });
  }
}
