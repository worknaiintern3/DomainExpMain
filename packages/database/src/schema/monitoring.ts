import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { domains } from './portfolio';
import {
  lifecycleTimestamps,
  workspaceMembers,
  workspaces,
} from './tenancy';

export const monitoringResultStatusEnum = pgEnum('monitoring_result_status', [
  'SUCCESS',
  'PARTIAL',
  'FAILED',
]);

export const monitoringRunTriggerEnum = pgEnum('monitoring_run_trigger', [
  'SCHEDULED',
  'MANUAL',
  'RETRY',
]);

export const monitoringRunStatusEnum = pgEnum('monitoring_run_status', [
  'QUEUED',
  'RUNNING',
  'SUCCESS',
  'PARTIAL',
  'FAILED',
]);

export const alertRuleKeyEnum = pgEnum('alert_rule_key', [
  'DOMAIN_EXPIRY_CRITICAL',
  'DOMAIN_EXPIRY_WARNING',
  'TLS_EXPIRY_CRITICAL',
  'TLS_EXPIRY_WARNING',
  'RETRIEVAL_FAILURE_REPEATED',
  'DNS_CHANGED',
  'CERT_CHANGED',
]);

export const alertSeverityEnum = pgEnum('alert_severity', [
  'CRITICAL',
  'WARNING',
  'INFO',
]);

export const alertEventStatusEnum = pgEnum('alert_event_status', [
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED',
]);

export const monitoringTargets = pgTable(
  'monitoring_targets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    domainId: uuid('domain_id').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    checkIntervalMinutes: integer('check_interval_minutes')
      .default(1_440)
      .notNull(),
    nextRunAt: timestamp('next_run_at', { mode: 'date', withTimezone: true }),
    lastRunAt: timestamp('last_run_at', { mode: 'date', withTimezone: true }),
    lastRunStatus: monitoringResultStatusEnum('last_run_status'),
    consecutiveFailures: integer('consecutive_failures').default(0).notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('monitoring_targets_workspace_id_id_unique').on(
      table.workspaceId,
      table.id,
    ),
    unique('monitoring_targets_workspace_id_domain_id_unique').on(
      table.workspaceId,
      table.id,
      table.domainId,
    ),
    uniqueIndex('monitoring_targets_workspace_domain_unique').on(
      table.workspaceId,
      table.domainId,
    ),
    index('monitoring_targets_due_idx')
      .on(table.nextRunAt, table.id)
      .where(sql`${table.enabled} and ${table.nextRunAt} is not null`),
    foreignKey({
      columns: [table.workspaceId, table.domainId],
      foreignColumns: [domains.workspaceId, domains.id],
      name: 'monitoring_targets_domain_fk',
    }).onDelete('cascade'),
    check(
      'monitoring_targets_interval_bounds',
      sql`${table.checkIntervalMinutes} between 60 and 10080`,
    ),
    check(
      'monitoring_targets_consecutive_failures_nonnegative',
      sql`${table.consecutiveFailures} >= 0`,
    ),
    check(
      'monitoring_targets_last_run_consistent',
      sql`(${table.lastRunAt} is null) = (${table.lastRunStatus} is null)`,
    ),
  ],
);

export const monitoringRuns = pgTable(
  'monitoring_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    targetId: uuid('target_id').notNull(),
    domainId: uuid('domain_id').notNull(),
    trigger: monitoringRunTriggerEnum('trigger').notNull(),
    status: monitoringRunStatusEnum('status').default('QUEUED').notNull(),
    availableAt: timestamp('available_at', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    claimedAt: timestamp('claimed_at', { mode: 'date', withTimezone: true }),
    leaseExpiresAt: timestamp('lease_expires_at', {
      mode: 'date',
      withTimezone: true,
    }),
    startedAt: timestamp('started_at', { mode: 'date', withTimezone: true }),
    finishedAt: timestamp('finished_at', { mode: 'date', withTimezone: true }),
    durationMs: integer('duration_ms'),
    attemptNo: integer('attempt_no').default(1).notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    errorCode: text('error_code'),
    sourcesAttempted: text('sources_attempted')
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    sourcesSucceeded: text('sources_succeeded')
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    runMetadata: jsonb('run_metadata')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('monitoring_runs_workspace_id_id_unique').on(
      table.workspaceId,
      table.id,
    ),
    uniqueIndex('monitoring_runs_workspace_target_idempotency_unique').on(
      table.workspaceId,
      table.targetId,
      table.idempotencyKey,
    ),
    index('monitoring_runs_queue_due_idx')
      .on(table.availableAt, table.createdAt, table.id)
      .where(sql`${table.status} = 'QUEUED'`),
    index('monitoring_runs_workspace_domain_created_idx').on(
      table.workspaceId,
      table.domainId,
      table.createdAt,
    ),
    index('monitoring_runs_retention_idx')
      .on(table.status, table.finishedAt)
      .where(sql`${table.status} in ('SUCCESS', 'PARTIAL', 'FAILED')`),
    foreignKey({
      columns: [table.workspaceId, table.targetId, table.domainId],
      foreignColumns: [
        monitoringTargets.workspaceId,
        monitoringTargets.id,
        monitoringTargets.domainId,
      ],
      name: 'monitoring_runs_target_domain_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.workspaceId, table.domainId],
      foreignColumns: [domains.workspaceId, domains.id],
      name: 'monitoring_runs_domain_fk',
    }).onDelete('cascade'),
    check(
      'monitoring_runs_duration_nonnegative',
      sql`${table.durationMs} is null or ${table.durationMs} >= 0`,
    ),
    check('monitoring_runs_attempt_positive', sql`${table.attemptNo} >= 1`),
    check(
      'monitoring_runs_idempotency_key_not_blank',
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
    check(
      'monitoring_runs_error_code_canonical',
      sql`${table.errorCode} is null or ${table.errorCode} ~ '^[A-Z0-9_]{1,64}$'`,
    ),
    check(
      'monitoring_runs_sources_allowed',
      sql`${table.sourcesAttempted} <@ ARRAY['rdap', 'dns', 'tls']::text[] and ${table.sourcesSucceeded} <@ ${table.sourcesAttempted}`,
    ),
    check(
      'monitoring_runs_metadata_object',
      sql`jsonb_typeof(${table.runMetadata}) = 'object'`,
    ),
    check(
      'monitoring_runs_timestamp_order',
      sql`(${table.leaseExpiresAt} is null or ${table.claimedAt} is null or ${table.leaseExpiresAt} > ${table.claimedAt}) and (${table.finishedAt} is null or ${table.startedAt} is null or ${table.finishedAt} >= ${table.startedAt})`,
    ),
    check(
      'monitoring_runs_state_consistent',
      sql`
        (
          ${table.status} = 'QUEUED'
          and ${table.claimedAt} is null
          and ${table.leaseExpiresAt} is null
          and ${table.startedAt} is null
          and ${table.finishedAt} is null
          and ${table.durationMs} is null
        )
        or
        (
          ${table.status} = 'RUNNING'
          and ${table.claimedAt} is not null
          and ${table.leaseExpiresAt} is not null
          and ${table.startedAt} is not null
          and ${table.finishedAt} is null
          and ${table.durationMs} is null
        )
        or
        (
          ${table.status} in ('SUCCESS', 'PARTIAL', 'FAILED')
          and ${table.startedAt} is not null
          and ${table.finishedAt} is not null
          and ${table.leaseExpiresAt} is null
        )
      `,
    ),
    check(
      'monitoring_runs_error_status_consistent',
      sql`
        (
          ${table.status} in ('QUEUED', 'RUNNING', 'SUCCESS')
          and ${table.errorCode} is null
        )
        or
        (
          ${table.status} in ('PARTIAL', 'FAILED')
          and ${table.errorCode} is not null
        )
      `,
    ),
  ],
);

export const alertRules = pgTable(
  'alert_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    key: alertRuleKeyEnum('key').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    severity: alertSeverityEnum('severity').notNull(),
    thresholdDays: integer('threshold_days'),
    thresholdCount: integer('threshold_count'),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('alert_rules_workspace_id_id_unique').on(
      table.workspaceId,
      table.id,
    ),
    uniqueIndex('alert_rules_workspace_key_unique').on(
      table.workspaceId,
      table.key,
    ),
    check(
      'alert_rules_threshold_days_nonnegative',
      sql`${table.thresholdDays} is null or ${table.thresholdDays} >= 0`,
    ),
    check(
      'alert_rules_threshold_count_positive',
      sql`${table.thresholdCount} is null or ${table.thresholdCount} >= 1`,
    ),
    check(
      'alert_rules_threshold_kind_consistent',
      sql`
        (
          ${table.key} in (
            'DOMAIN_EXPIRY_CRITICAL',
            'DOMAIN_EXPIRY_WARNING',
            'TLS_EXPIRY_CRITICAL',
            'TLS_EXPIRY_WARNING'
          )
          and ${table.thresholdDays} is not null
          and ${table.thresholdCount} is null
        )
        or
        (
          ${table.key} = 'RETRIEVAL_FAILURE_REPEATED'
          and ${table.thresholdDays} is null
          and ${table.thresholdCount} is not null
        )
        or
        (
          ${table.key} in ('DNS_CHANGED', 'CERT_CHANGED')
          and ${table.thresholdDays} is null
          and ${table.thresholdCount} is null
        )
      `,
    ),
  ],
);

export const alertEvents = pgTable(
  'alert_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    ruleId: uuid('rule_id'),
    domainId: uuid('domain_id').notNull(),
    targetId: uuid('target_id'),
    dedupeKey: text('dedupe_key').notNull(),
    severity: alertSeverityEnum('severity').notNull(),
    status: alertEventStatusEnum('status').default('OPEN').notNull(),
    title: text('title').notNull(),
    detail: text('detail').notNull(),
    evidence: jsonb('evidence')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    firstSeenAt: timestamp('first_seen_at', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp('last_seen_at', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp('resolved_at', { mode: 'date', withTimezone: true }),
    ackedAt: timestamp('acked_at', { mode: 'date', withTimezone: true }),
    ackedByUserId: uuid('acked_by_user_id'),
    occurrenceCount: integer('occurrence_count').default(1).notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('alert_events_workspace_id_id_unique').on(
      table.workspaceId,
      table.id,
    ),
    uniqueIndex('alert_events_workspace_active_dedupe_unique')
      .on(table.workspaceId, table.dedupeKey)
      .where(sql`${table.status} in ('OPEN', 'ACKNOWLEDGED')`),
    index('alert_events_workspace_status_last_seen_idx').on(
      table.workspaceId,
      table.status,
      table.lastSeenAt,
    ),
    index('alert_events_workspace_domain_last_seen_idx').on(
      table.workspaceId,
      table.domainId,
      table.lastSeenAt,
    ),
    foreignKey({
      columns: [table.workspaceId, table.ruleId],
      foreignColumns: [alertRules.workspaceId, alertRules.id],
      name: 'alert_events_rule_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.workspaceId, table.domainId],
      foreignColumns: [domains.workspaceId, domains.id],
      name: 'alert_events_domain_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.workspaceId, table.targetId, table.domainId],
      foreignColumns: [
        monitoringTargets.workspaceId,
        monitoringTargets.id,
        monitoringTargets.domainId,
      ],
      name: 'alert_events_target_domain_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.workspaceId, table.ackedByUserId],
      foreignColumns: [workspaceMembers.workspaceId, workspaceMembers.userId],
      name: 'alert_events_acked_by_member_fk',
    }).onDelete('restrict'),
    check(
      'alert_events_dedupe_key_not_blank',
      sql`length(btrim(${table.dedupeKey})) > 0`,
    ),
    check(
      'alert_events_title_not_blank',
      sql`length(btrim(${table.title})) > 0`,
    ),
    check(
      'alert_events_detail_not_blank',
      sql`length(btrim(${table.detail})) > 0`,
    ),
    check(
      'alert_events_occurrence_count_positive',
      sql`${table.occurrenceCount} >= 1`,
    ),
    check(
      'alert_events_evidence_object',
      sql`jsonb_typeof(${table.evidence}) = 'object'`,
    ),
    check(
      'alert_events_seen_order',
      sql`${table.lastSeenAt} >= ${table.firstSeenAt}`,
    ),
    check(
      'alert_events_ack_pair_consistent',
      sql`(${table.ackedAt} is null) = (${table.ackedByUserId} is null)`,
    ),
    check(
      'alert_events_status_consistent',
      sql`
        (
          ${table.status} = 'OPEN'
          and ${table.ackedAt} is null
          and ${table.resolvedAt} is null
        )
        or
        (
          ${table.status} = 'ACKNOWLEDGED'
          and ${table.ackedAt} is not null
          and ${table.resolvedAt} is null
        )
        or
        (
          ${table.status} = 'RESOLVED'
          and ${table.resolvedAt} is not null
        )
      `,
    ),
  ],
);

export type MonitoringTarget = typeof monitoringTargets.$inferSelect;
export type NewMonitoringTarget = typeof monitoringTargets.$inferInsert;
export type MonitoringRun = typeof monitoringRuns.$inferSelect;
export type NewMonitoringRun = typeof monitoringRuns.$inferInsert;
export type AlertRule = typeof alertRules.$inferSelect;
export type NewAlertRule = typeof alertRules.$inferInsert;
export type AlertEvent = typeof alertEvents.$inferSelect;
export type NewAlertEvent = typeof alertEvents.$inferInsert;
