import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

describe('domain metadata migration structure', () => {
  let migrationSql = '';

  beforeAll(async () => {
    migrationSql = await readFile(
      resolve('migrations/0006_domain_metadata.sql'),
      'utf8',
    );
  });

  it('creates the locked domain metadata attempt status enum', () => {
    expect(migrationSql).toContain(
      `CREATE TYPE "public"."domain_metadata_attempt_status" AS ENUM('SUCCESS', 'PARTIAL', 'FAILED')`,
    );
  });

  it('creates exactly the three Phase 8 latest metadata tables', () => {
    for (const table of [
      'domain_rdap_metadata',
      'domain_dns_metadata',
      'domain_tls_metadata',
    ]) {
      expect(migrationSql).toContain(`CREATE TABLE "${table}"`);
      expect(migrationSql).toContain(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
    }
  });

  it('uses workspace-scoped composite domain foreign keys', () => {
    expect(migrationSql).toContain(
      `FOREIGN KEY ("workspace_id","domain_id") REFERENCES "public"."domains"("workspace_id","id")`,
    );

    expect(
      migrationSql.match(
        /FOREIGN KEY \("workspace_id","domain_id"\) REFERENCES "public"\."domains"\("workspace_id","id"\)/gu,
      ),
    ).toHaveLength(3);
  });

  it('locks metadata provenance to its real retrieval source', () => {
    expect(migrationSql).toContain(
      `"domain_rdap_metadata"."provenance" = 'RDAP_RETRIEVED'`,
    );

    expect(migrationSql).toContain(
      `"domain_dns_metadata"."provenance" = 'DNS_RETRIEVED'`,
    );

    expect(migrationSql).toContain(
      `"domain_tls_metadata"."provenance" = 'SSL_RETRIEVED'`,
    );
  });

  it('enforces sanitized error-code and attempt-state consistency', () => {
    for (const table of [
      'domain_rdap_metadata',
      'domain_dns_metadata',
      'domain_tls_metadata',
    ]) {
      expect(migrationSql).toContain(
        `CONSTRAINT "${table}_error_code_canonical"`,
      );

      expect(migrationSql).toContain(
        `CONSTRAINT "${table}_attempt_error_consistent"`,
      );
    }
  });

  it('does not persist raw DNS TXT values', () => {
    expect(migrationSql).toContain('"txt_record_count"');
    expect(migrationSql).not.toContain('"txt_records"');
    expect(migrationSql).not.toContain('"txt_record_values"');
  });

  it('keeps TLS hostname match derived instead of persisted', () => {
    expect(migrationSql).not.toContain('"hostname_match"');
    expect(migrationSql).toContain('"subject_alt_names"');
  });

  it('installs fail-closed workspace RLS policies on all metadata tables', () => {
    for (const table of [
      'domain_rdap_metadata',
      'domain_dns_metadata',
      'domain_tls_metadata',
    ]) {
      expect(migrationSql).toContain(
        `CREATE POLICY "${table}_workspace_isolation"`,
      );
    }

    expect(
      migrationSql.match(
        /"workspace_id" = "domainpulse"\."current_workspace_id"\(\)/gu,
      ),
    ).toHaveLength(6);
  });

  it('does not introduce monitoring history or alert tables in Phase 8', () => {
    expect(migrationSql).not.toContain('metadata_history');
    expect(migrationSql).not.toContain('monitoring_checks');
    expect(migrationSql).not.toContain('alerts');
  });
});
