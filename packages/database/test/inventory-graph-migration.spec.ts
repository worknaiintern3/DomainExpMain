import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

describe('inventory graph migration structure', () => {
  let migrationSql = '';

  beforeAll(async () => {
    migrationSql = await readFile(
      resolve('migrations/0005_inventory_graph.sql'),
      'utf8',
    );
  });

  it('backfills and installs lifecycle triggers for exactly five entity kinds', () => {
    for (const tableName of [
      'projects',
      'domains',
      'servers',
      'cloud_resources',
      'website_applications',
    ]) {
      expect(migrationSql).toContain(`FROM "public"."${tableName}"`);
      expect(migrationSql).toContain(
        `AFTER INSERT ON "public"."${tableName}"`,
      );
      expect(migrationSql).toContain(
        `AFTER DELETE ON "public"."${tableName}"`,
      );
      expect(migrationSql).toContain(
        `BEFORE UPDATE OF "id", "workspace_id" ON "public"."${tableName}"`,
      );
    }
    expect(migrationSql).not.toContain('email_accounts_inventory_node');
    expect(migrationSql).not.toContain('provider_accounts_inventory_node');
    expect(migrationSql).not.toContain(
      'BEFORE INSERT ON "public"."projects"',
    );
  });

  it('hardens trigger functions and revokes public execution', () => {
    expect(migrationSql.match(/SECURITY DEFINER/gu)).toHaveLength(4);
    expect(migrationSql.match(/SET search_path = pg_catalog/gu)).toHaveLength(5);
    expect(migrationSql.match(/REVOKE ALL ON FUNCTION/gu)).toHaveLength(5);
    expect(migrationSql).not.toContain('EXECUTE FORMAT');
  });

  it('enables the locked fail-closed RLS policies', () => {
    expect(migrationSql).toContain(
      'ALTER TABLE "inventory_nodes" ENABLE ROW LEVEL SECURITY',
    );
    expect(migrationSql).toContain(
      'CREATE POLICY "inventory_nodes_workspace_select"',
    );
    expect(migrationSql).toContain(
      'ALTER TABLE "inventory_relationships" ENABLE ROW LEVEL SECURITY',
    );
    expect(migrationSql).toContain(
      'CREATE POLICY "inventory_relationships_workspace_isolation"',
    );
    expect(migrationSql).toContain(
      'WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"())',
    );
  });
});
