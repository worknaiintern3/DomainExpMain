import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

interface MigrationJournal {
  readonly entries: readonly {
    readonly idx: number;
    readonly tag: string;
  }[];
}

describe('provider sync runtime migration', () => {
  let migrationSql = '';
  let journal: MigrationJournal;

  beforeAll(async () => {
    migrationSql = await readFile(
      resolve('migrations/0012_provider_sync_runtime.sql'),
      'utf8',
    );
    journal = JSON.parse(
      await readFile(resolve('migrations/meta/_journal.json'), 'utf8'),
    ) as MigrationJournal;
  });

  it('registers 0012 immediately after 0011 with generated snapshot metadata', async () => {
    expect(journal.entries.find((entry) => entry.idx === 12)).toMatchObject({
      idx: 12,
      tag: '0012_provider_sync_runtime',
    });
    await expect(
      readFile(resolve('migrations/meta/0012_snapshot.json'), 'utf8'),
    ).resolves.toContain('provider_sync_runs');
  });

  it('never touches a locked 0000-0011 migration file', async () => {
    for (const lockedFile of [
      '0009_monitoring_worker_functions.sql',
      '0011_provider_connections.sql',
    ]) {
      const lockedSql = await readFile(resolve(`migrations/${lockedFile}`), 'utf8');
      expect(lockedSql).not.toContain('provider_sync_runs');
      expect(lockedSql).not.toContain('provider_resource_links');
    }
  });

  it('adds only a bounded sync interval column to provider_connections, never touching its 10B envelope', () => {
    expect(migrationSql).toContain(
      'ALTER TABLE "provider_connections" ADD COLUMN "sync_interval_minutes" integer DEFAULT 1440 NOT NULL',
    );
    expect(migrationSql).toContain(
      'CONSTRAINT "provider_connections_sync_interval_bounds" CHECK ("provider_connections"."sync_interval_minutes" between 60 and 10080)',
    );
    expect(migrationSql).not.toMatch(/ALTER TABLE "provider_connections" DROP/u);
    expect(migrationSql).not.toContain('encrypted_ciphertext');
    expect(migrationSql).not.toContain('encryption_iv');
    expect(migrationSql).not.toContain('encryption_auth_tag');
  });

  it('creates provider_sync_runs as a durable queue with a full state machine', () => {
    expect(migrationSql).toContain('CREATE TABLE "provider_sync_runs"');
    expect(migrationSql).toContain(
      '"provider_sync_run_trigger" AS ENUM(\'INITIAL\', \'MANUAL\', \'SCHEDULED\', \'RETRY\')',
    );
    expect(migrationSql).toContain(
      '"provider_sync_run_status" AS ENUM(\'QUEUED\', \'RUNNING\', \'SUCCESS\', \'PARTIAL\', \'FAILED\')',
    );
    expect(migrationSql).toContain(
      'CONSTRAINT "provider_sync_runs_workspace_connection_idempotency_unique" UNIQUE("workspace_id","connection_id","idempotency_key")',
    );
    expect(migrationSql).toContain('CONSTRAINT "provider_sync_runs_state_consistent"');
    expect(migrationSql).toContain('CONSTRAINT "provider_sync_runs_error_status_consistent"');
    expect(migrationSql).toContain('CONSTRAINT "provider_sync_runs_items_nonnegative"');
    expect(migrationSql).toContain(
      'CONSTRAINT "provider_sync_runs_idempotency_key_internal_hash"',
    );
    expect(migrationSql).toContain(
      'CONSTRAINT "provider_sync_runs_metadata_bounded"',
    );
    expect(migrationSql).not.toMatch(/password|secret|token|ciphertext/iu);
  });

  it('creates provider_resource_links reusing graph entity type integrity, not a free-form type column', () => {
    expect(migrationSql).toContain('CREATE TABLE "provider_resource_links"');
    expect(migrationSql).toContain('"entity_kind" "graph_entity_kind" NOT NULL');
    expect(migrationSql).toContain(
      'FOREIGN KEY ("workspace_id","node_id","entity_kind") REFERENCES "public"."inventory_nodes"("workspace_id","node_id","entity_kind")',
    );
    expect(migrationSql).toContain(
      "CONSTRAINT \"provider_resource_links_entity_kind_allowed\" CHECK (\"provider_resource_links\".\"entity_kind\" in ('DOMAIN', 'SERVER', 'CLOUD_RESOURCE'))",
    );
    expect(migrationSql).not.toContain('internal_resource_type');
    expect(migrationSql).toContain(
      'CONSTRAINT "provider_resource_links_workspace_connection_external_unique" UNIQUE("workspace_id","connection_id","external_resource_type","external_resource_id")',
    );
    expect(migrationSql).toContain('CONSTRAINT "provider_resource_links_status_consistent"');
    expect(migrationSql).toContain(
      'CONSTRAINT "provider_resource_links_metadata_bounded"',
    );
  });

  it('never uniques resource links on node_id, allowing legitimate relink after upstream recreation', () => {
    expect(migrationSql).not.toMatch(
      /UNIQUE\("workspace_id","node_id"/u,
    );
    expect(migrationSql).not.toMatch(
      /UNIQUE\("workspace_id","connection_id","node_id"/u,
    );
  });

  it('enables fail-closed workspace RLS on both new tables without role or bypass changes', () => {
    for (const table of ['provider_sync_runs', 'provider_resource_links']) {
      expect(migrationSql).toContain(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      expect(migrationSql).toContain(
        `CREATE POLICY "${table}_workspace_isolation" ON "${table}" FOR ALL USING ("workspace_id" = "domainpulse"."current_workspace_id"()) WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"())`,
      );
    }
    expect(migrationSql).not.toContain('BYPASSRLS');
    expect(migrationSql).not.toContain('CREATE ROLE');
    expect(migrationSql).not.toContain('GRANT EXECUTE');
  });

  it('creates only the three narrow cross-workspace queue functions, matching the Phase 9 pattern', () => {
    expect(migrationSql.match(/CREATE FUNCTION/gu)).toHaveLength(3);
    for (const functionName of [
      'schedule_due_provider_sync_runs',
      'claim_provider_sync_runs',
      'reclaim_expired_provider_sync_runs',
    ]) {
      expect(migrationSql).toContain(`"domainpulse"."${functionName}"`);
    }
    expect(migrationSql.match(/SECURITY DEFINER/gu)).toHaveLength(3);
    expect(migrationSql.match(/SET search_path = pg_catalog/gu)).toHaveLength(3);
    expect(migrationSql.match(/REVOKE ALL ON FUNCTION/gu)).toHaveLength(3);
    expect(migrationSql).not.toMatch(/EXECUTE\s+[^;]*\|\|/iu);
  });

  it('schedules only validated due connections with no in-flight run, locking and dedupe', () => {
    expect(migrationSql).toContain('c."validation_status" = \'VALID\'');
    expect(migrationSql).toContain('c."next_sync_at" <= p_now');
    expect(migrationSql).toContain('r."status" IN (\'QUEUED\', \'RUNNING\')');
    expect(migrationSql).toContain('FOR UPDATE OF c SKIP LOCKED');
    expect(migrationSql.match(/ON CONFLICT DO NOTHING/gu)).toHaveLength(2);
    expect(migrationSql).toContain('hashtextextended');
    expect(migrationSql).toContain('sha256(');
  });

  it('claims queued due work atomically with a bounded lease', () => {
    expect(migrationSql).toContain('r."status" = \'QUEUED\'');
    expect(migrationSql).toContain('r."available_at" <= p_now');
    expect(migrationSql).toContain('FOR UPDATE OF r SKIP LOCKED');
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
  });

  it('returns identifiers only and never credential, payload, or lease-internal detail', () => {
    const returns = migrationSql.match(/RETURNS TABLE \([\s\S]*?\)/gu) ?? [];
    expect(returns).toHaveLength(3);
    for (const block of returns) {
      expect(block).not.toMatch(/password|token|metadata|payload|url|ciphertext/iu);
    }
  });
});
