import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

describe('domain metadata provenance migration structure', () => {
  let migrationSql = '';

  beforeAll(async () => {
    migrationSql = await readFile(
      resolve('migrations/0007_metadata_provenance_nullable.sql'),
      'utf8',
    );
  });

  it('removes provenance defaults from all three metadata tables', () => {
    for (const table of [
      'domain_rdap_metadata',
      'domain_dns_metadata',
      'domain_tls_metadata',
    ]) {
      expect(migrationSql).toContain(
        `ALTER TABLE "${table}" ALTER COLUMN "provenance" DROP DEFAULT`,
      );
    }
  });

  it('makes provenance nullable for all three metadata tables', () => {
    for (const table of [
      'domain_rdap_metadata',
      'domain_dns_metadata',
      'domain_tls_metadata',
    ]) {
      expect(migrationSql).toContain(
        `ALTER TABLE "${table}" ALTER COLUMN "provenance" DROP NOT NULL`,
      );
    }
  });

  it('does not weaken RLS or modify unrelated schema', () => {
    expect(migrationSql).not.toContain('DROP POLICY');
    expect(migrationSql).not.toContain('DISABLE ROW LEVEL SECURITY');
    expect(migrationSql).not.toContain('ALTER TABLE "domains"');
    expect(migrationSql).not.toContain('CREATE TABLE');
    expect(migrationSql).not.toContain('DROP TABLE');
  });

  it('contains exactly six provenance alterations', () => {
    expect(
      migrationSql.match(
        /ALTER TABLE "domain_(?:rdap|dns|tls)_metadata" ALTER COLUMN "provenance"/gu,
      ),
    ).toHaveLength(6);
  });
});
