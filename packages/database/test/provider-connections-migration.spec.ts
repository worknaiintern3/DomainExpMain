import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

interface MigrationJournal {
  readonly entries: readonly {
    readonly idx: number;
    readonly tag: string;
  }[];
}

describe('provider connections migration', () => {
  let migrationSql = '';
  let journal: MigrationJournal;

  beforeAll(async () => {
    migrationSql = await readFile(
      resolve('migrations/0011_provider_connections.sql'),
      'utf8',
    );
    journal = JSON.parse(
      await readFile(resolve('migrations/meta/_journal.json'), 'utf8'),
    ) as MigrationJournal;
  });

  it('registers 0011 immediately after 0010 with generated snapshot metadata', async () => {
    expect(journal.entries.at(-1)).toMatchObject({
      idx: 11,
      tag: '0011_provider_connections',
    });
    await expect(
      readFile(resolve('migrations/meta/0011_snapshot.json'), 'utf8'),
    ).resolves.toContain('provider_connections');
  });

  it('creates the workspace-owned encrypted envelope table', () => {
    expect(migrationSql).toContain('CREATE TABLE "provider_connections"');
    expect(migrationSql).toContain('"encrypted_ciphertext" text NOT NULL');
    expect(migrationSql).toContain('"encryption_iv" text NOT NULL');
    expect(migrationSql).toContain('"encryption_auth_tag" text NOT NULL');
    expect(migrationSql).toContain('"key_version" integer NOT NULL');
    expect(migrationSql).toContain('"credential_mask" text NOT NULL');
    expect(migrationSql).toContain(
      '"provider_connection_auth_type" AS ENUM(\'CLOUDFLARE_API_TOKEN\')',
    );
    expect(migrationSql).not.toMatch(/plaintext|decrypted|credential_secret/iu);
  });

  it('keeps inventory identity separate and removes secrets with their account', () => {
    expect(migrationSql).toContain(
      'FOREIGN KEY ("workspace_id","provider_account_id") REFERENCES "public"."provider_accounts"("workspace_id","id") ON DELETE cascade',
    );
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX "provider_connections_workspace_account_unique"',
    );
    expect(migrationSql).not.toContain('ALTER TABLE "provider_accounts"');
  });

  it('enforces envelope shape, canonical codes, and validation consistency', () => {
    // AES-GCM ciphertext length equals plaintext byte length, so a 1-byte
    // credential encodes to 4 base64 characters; the minimum must not assume
    // a 16-byte floor. The 8192 upper bound covers the 4096-byte plaintext
    // contract (4096 bytes -> at most 5464 base64 characters).
    expect(migrationSql).toContain(
      'CONSTRAINT "provider_connections_ciphertext_envelope" CHECK (length("provider_connections"."encrypted_ciphertext") between 4 and 8192',
    );
    expect(migrationSql).toContain(
      'CONSTRAINT "provider_connections_iv_envelope"',
    );
    expect(migrationSql).toContain(
      'CONSTRAINT "provider_connections_auth_tag_envelope"',
    );
    expect(migrationSql).toContain(
      'CONSTRAINT "provider_connections_key_version_positive"',
    );
    expect(migrationSql).toContain(
      'CONSTRAINT "provider_connections_validation_consistent"',
    );
    expect(migrationSql).toContain(
      '"validation_status" = \'PENDING\'',
    );
  });

  it('enables fail-closed workspace RLS without role or bypass changes', () => {
    expect(migrationSql).toContain(
      'ALTER TABLE "provider_connections" ENABLE ROW LEVEL SECURITY',
    );
    expect(migrationSql).toContain(
      'CREATE POLICY "provider_connections_workspace_isolation" ON "provider_connections" FOR ALL USING ("workspace_id" = "domainpulse"."current_workspace_id"()) WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"())',
    );
    expect(migrationSql).not.toContain('GRANT');
    expect(migrationSql).not.toContain('BYPASSRLS');
    expect(migrationSql).not.toContain('CREATE ROLE');
  });
});
