import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

interface MigrationJournal {
  readonly entries: readonly {
    readonly idx: number;
    readonly tag: string;
  }[];
}

describe('monitoring retention migration', () => {
  let migrationSql = '';
  let journal: MigrationJournal;

  beforeAll(async () => {
    migrationSql = await readFile(
      resolve('migrations/0010_monitoring_retention.sql'),
      'utf8',
    );
    journal = JSON.parse(
      await readFile(resolve('migrations/meta/_journal.json'), 'utf8'),
    ) as MigrationJournal;
  });

  it('registers 0010 immediately after 0009 with generated snapshot metadata', async () => {
    expect(journal.entries.at(-1)).toMatchObject({
      idx: 10,
      tag: '0010_monitoring_retention',
    });
    await expect(
      readFile(resolve('migrations/meta/0010_snapshot.json'), 'utf8'),
    ).resolves.toContain('monitoring_runs_retention_idx');
  });

  it('creates the intended terminal status and finished-at partial index', () => {
    expect(migrationSql).toContain(
      'CREATE INDEX "monitoring_runs_retention_idx" ON "monitoring_runs" USING btree ("status","finished_at")',
    );
    expect(migrationSql).toContain(
      'WHERE "monitoring_runs"."status" in (\'SUCCESS\', \'PARTIAL\', \'FAILED\')',
    );
  });

  it('uses a narrow locked and bounded definer cleanup function', () => {
    expect(migrationSql).toContain(
      '"domainpulse"."cleanup_old_terminal_monitoring_runs"',
    );
    expect(migrationSql).toContain('SECURITY DEFINER');
    expect(migrationSql).toContain('SET search_path = pg_catalog');
    expect(migrationSql).toContain('FROM "public"."monitoring_runs" AS mr');
    expect(migrationSql).toContain('FOR UPDATE OF mr SKIP LOCKED');
    expect(migrationSql).toContain('p_limit < 1 OR p_limit > 1000');
    expect(migrationSql).toContain(
      'mr."status" IN (\'SUCCESS\', \'PARTIAL\', \'FAILED\')',
    );
    expect(migrationSql).not.toContain("'QUEUED'");
    expect(migrationSql).not.toContain("'RUNNING'");
  });

  it('revokes PUBLIC and introduces no role or RLS bypass', () => {
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION "domainpulse"."cleanup_old_terminal_monitoring_runs"',
    );
    expect(migrationSql).not.toContain('GRANT');
    expect(migrationSql).not.toContain('BYPASSRLS');
    expect(migrationSql).not.toContain('CREATE ROLE');
    expect(migrationSql).not.toMatch(/EXECUTE\s+[^;]*\|\|/iu);
  });
});
