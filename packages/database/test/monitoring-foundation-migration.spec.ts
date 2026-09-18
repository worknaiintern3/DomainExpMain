import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

describe('monitoring foundation migration structure', () => {
  let migrationSql = '';

  beforeAll(async () => {
    migrationSql = await readFile(
      resolve('migrations/0008_monitoring_foundation.sql'),
      'utf8',
    );
  });

  it('creates only the four Phase 9B monitoring tables', () => {
    for (const table of [
      'monitoring_targets',
      'monitoring_runs',
      'alert_rules',
      'alert_events',
    ]) {
      expect(migrationSql).toContain(`CREATE TABLE "${table}"`);
    }
    for (const forbiddenTable of [
      'monitoring_jobs',
      'monitoring_checks',
      'monitoring_history',
      'alert_acknowledgements',
    ]) {
      expect(migrationSql).not.toContain(`CREATE TABLE "${forbiddenTable}"`);
    }
  });

  it('defines the locked run, result, trigger, rule, severity, and alert enums', () => {
    expect(migrationSql).toContain(
      `"monitoring_result_status" AS ENUM('SUCCESS', 'PARTIAL', 'FAILED')`,
    );
    expect(migrationSql).toContain(
      `"monitoring_run_status" AS ENUM('QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED')`,
    );
    expect(migrationSql).toContain(
      `"monitoring_run_trigger" AS ENUM('SCHEDULED', 'MANUAL', 'RETRY')`,
    );
    expect(migrationSql).toContain(
      `"alert_event_status" AS ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED')`,
    );
    expect(migrationSql).not.toContain('HEALTHY');
    expect(migrationSql).not.toContain('ONLINE');
    expect(migrationSql).not.toContain('OFFLINE');
  });

  it('enforces tenant-safe composite references', () => {
    expect(migrationSql).toContain(
      `FOREIGN KEY ("workspace_id","domain_id") REFERENCES "public"."domains"("workspace_id","id")`,
    );
    expect(migrationSql).toContain(
      `FOREIGN KEY ("workspace_id","target_id","domain_id") REFERENCES "public"."monitoring_targets"("workspace_id","id","domain_id")`,
    );
    expect(migrationSql).toContain(
      `FOREIGN KEY ("workspace_id","rule_id") REFERENCES "public"."alert_rules"("workspace_id","id")`,
    );
    expect(migrationSql).toContain(
      `FOREIGN KEY ("workspace_id","acked_by_user_id") REFERENCES "public"."workspace_members"("workspace_id","user_id")`,
    );
  });

  it('installs the target, queue, history, rule, and active-alert indexes', () => {
    for (const indexName of [
      'monitoring_targets_workspace_domain_unique',
      'monitoring_targets_due_idx',
      'monitoring_runs_workspace_target_idempotency_unique',
      'monitoring_runs_queue_due_idx',
      'monitoring_runs_workspace_domain_created_idx',
      'alert_rules_workspace_key_unique',
      'alert_events_workspace_active_dedupe_unique',
      'alert_events_workspace_status_last_seen_idx',
    ]) {
      expect(migrationSql).toContain(`"${indexName}"`);
    }
    expect(migrationSql).toContain(
      `WHERE "alert_events"."status" in ('OPEN', 'ACKNOWLEDGED')`,
    );
  });

  it('locks interval, run-state, error, source, threshold, and alert-state checks', () => {
    for (const constraintName of [
      'monitoring_targets_interval_bounds',
      'monitoring_targets_consecutive_failures_nonnegative',
      'monitoring_runs_attempt_positive',
      'monitoring_runs_error_code_canonical',
      'monitoring_runs_sources_allowed',
      'monitoring_runs_state_consistent',
      'monitoring_runs_error_status_consistent',
      'alert_rules_threshold_kind_consistent',
      'alert_events_occurrence_count_positive',
      'alert_events_status_consistent',
    ]) {
      expect(migrationSql).toContain(`CONSTRAINT "${constraintName}"`);
    }
  });

  it('enables fail-closed workspace RLS on every Phase 9B table', () => {
    for (const table of [
      'monitoring_targets',
      'monitoring_runs',
      'alert_rules',
      'alert_events',
    ]) {
      expect(migrationSql).toContain(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      expect(migrationSql).toContain(
        `CREATE POLICY "${table}_workspace_isolation"`,
      );
    }
    expect(
      migrationSql.match(
        /"workspace_id" = "domainpulse"\."current_workspace_id"\(\)/gu,
      ),
    ).toHaveLength(8);
    expect(migrationSql).not.toContain('BYPASSRLS');
  });

  it('does not persist forbidden raw retrieval or credential material', () => {
    for (const forbiddenColumn of [
      'raw_txt',
      'rdap_json',
      'http_body',
      'pem',
      'private_key',
      'token',
      'credential',
    ]) {
      expect(migrationSql).not.toContain(`"${forbiddenColumn}"`);
    }
  });
});
