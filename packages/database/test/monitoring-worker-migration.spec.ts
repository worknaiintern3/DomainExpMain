import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

describe('monitoring worker migration structure', () => {
  let migrationSql = '';

  beforeAll(async () => {
    migrationSql = await readFile(
      resolve('migrations/0009_monitoring_worker_functions.sql'),
      'utf8',
    );
  });

  it('creates only the three narrow worker queue functions', () => {
    expect(migrationSql.match(/CREATE FUNCTION/gu)).toHaveLength(3);
    for (const functionName of [
      'schedule_due_monitoring_runs',
      'claim_monitoring_runs',
      'reclaim_expired_monitoring_runs',
    ]) {
      expect(migrationSql).toContain(`"domainpulse"."${functionName}"`);
    }
    expect(migrationSql).not.toContain('CREATE TABLE');
    expect(migrationSql).not.toContain('CREATE ROLE');
  });

  it('locks each function to its owner, a safe search path, and explicit grants', () => {
    expect(migrationSql.match(/SECURITY DEFINER/gu)).toHaveLength(3);
    expect(migrationSql.match(/SET search_path = pg_catalog/gu)).toHaveLength(3);
    expect(migrationSql.match(/REVOKE ALL ON FUNCTION/gu)).toHaveLength(3);
    expect(migrationSql).not.toContain('GRANT EXECUTE');
    expect(migrationSql).not.toContain('BYPASSRLS');
    expect(migrationSql).not.toMatch(/EXECUTE\s+[^;]*\|\|/iu);
  });

  it('schedules only due enabled tracked targets with locking and dedupe', () => {
    expect(migrationSql).toContain('t."enabled" = true');
    expect(migrationSql).toContain('d."inventory_state" = \'TRACKED\'');
    expect(migrationSql).toContain('t."next_run_at" <= p_now');
    expect(migrationSql).toContain('FOR UPDATE OF t SKIP LOCKED');
    expect(migrationSql.match(/ON CONFLICT DO NOTHING/gu)).toHaveLength(2);
    expect(migrationSql).not.toMatch(
      /ON CONFLICT\s*\(\s*"workspace_id"/gu,
    );
    expect(migrationSql).toContain('hashtextextended');
  });

  it('claims queued due work atomically with a bounded lease', () => {
    expect(migrationSql).toContain('r."status" = \'QUEUED\'');
    expect(migrationSql).toContain('r."available_at" <= p_now');
    expect(migrationSql).toContain('FOR UPDATE OF r SKIP LOCKED');
    expect(migrationSql).toContain('"status" = \'RUNNING\'');
    expect(migrationSql).toContain(
      'p_now + p_lease_ms * interval \'1 millisecond\'',
    );
  });

  it('fails expired leases and queues only capped 5/20/60 retries', () => {
    expect(migrationSql).toContain('r."lease_expires_at" <= p_now');
    expect(migrationSql).toContain('"error_code" = \'WORKER_LEASE_EXPIRED\'');
    expect(migrationSql).toContain('WHEN 1 THEN interval \'5 minutes\'');
    expect(migrationSql).toContain('WHEN 2 THEN interval \'20 minutes\'');
    expect(migrationSql).toContain('ELSE interval \'60 minutes\'');
    expect(migrationSql).toContain('r."attempt_no" <= p_max_retries');
    expect(migrationSql).toContain('"consecutive_failures" + 1');
  });

  it('returns identifiers only and never credential or retrieval payloads', () => {
    const returns = migrationSql.match(/RETURNS TABLE \([\s\S]*?\)/gu) ?? [];
    expect(returns).toHaveLength(3);
    for (const block of returns) {
      expect(block).not.toMatch(/password|token|metadata|snapshot|payload|url/iu);
    }
  });
});
