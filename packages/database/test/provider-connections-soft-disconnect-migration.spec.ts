import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

interface MigrationJournal {
  readonly entries: readonly {
    readonly idx: number;
    readonly tag: string;
  }[];
}

describe('provider connections soft disconnect migration', () => {
  let migrationSql = '';
  let journal: MigrationJournal;

  beforeAll(async () => {
    migrationSql = await readFile(
      resolve('migrations/0013_provider_connections_soft_disconnect.sql'),
      'utf8',
    );
    journal = JSON.parse(
      await readFile(resolve('migrations/meta/_journal.json'), 'utf8'),
    ) as MigrationJournal;
  });

  it('registers 0013 immediately after 0012 with generated snapshot metadata', async () => {
    const migrationIndex = journal.entries.findIndex(
      ({ tag }) => tag === '0013_provider_connections_soft_disconnect',
    );
    expect(journal.entries[migrationIndex]).toMatchObject({
      idx: 13,
      tag: '0013_provider_connections_soft_disconnect',
    });
    expect(journal.entries[migrationIndex - 1]?.tag).toBe(
      '0012_provider_sync_runtime',
    );
    await expect(
      readFile(
        resolve('migrations/meta/0013_snapshot.json'),
        'utf8',
      ),
    ).resolves.toContain('provider_connection_status');
  });

  it('only touches provider_connections, never a locked 0000-0012 migration file', async () => {
    for (const lockedFile of [
      '0011_provider_connections.sql',
      '0012_provider_sync_runtime.sql',
    ]) {
      const lockedSql = await readFile(resolve(`migrations/${lockedFile}`), 'utf8');
      expect(lockedSql).not.toContain('"connection_status"');
      expect(lockedSql).not.toContain('disconnected_at');
    }
    expect(migrationSql).not.toContain('CREATE TABLE');
    expect(migrationSql).not.toContain('DROP TABLE');
  });

  it('makes the encrypted envelope nullable so soft disconnect can clear it', () => {
    expect(migrationSql).toContain(
      'ALTER TABLE "provider_connections" ALTER COLUMN "encrypted_ciphertext" DROP NOT NULL',
    );
    expect(migrationSql).toContain(
      'ALTER TABLE "provider_connections" ALTER COLUMN "encryption_iv" DROP NOT NULL',
    );
    expect(migrationSql).toContain(
      'ALTER TABLE "provider_connections" ALTER COLUMN "encryption_auth_tag" DROP NOT NULL',
    );
    expect(migrationSql).toContain(
      'ALTER TABLE "provider_connections" ALTER COLUMN "key_version" DROP NOT NULL',
    );
    // credential_mask remains NOT NULL: disconnect sets a safe display value,
    // it never stores NULL or a secret.
    expect(migrationSql).not.toContain('"credential_mask" DROP NOT NULL');
  });

  it('adds a connection_status lifecycle column defaulting existing rows to CONNECTED', () => {
    expect(migrationSql).toContain(
      '"provider_connection_status" AS ENUM(\'CONNECTED\', \'DISCONNECTED\')',
    );
    expect(migrationSql).toContain(
      'ADD COLUMN "connection_status" "provider_connection_status" DEFAULT \'CONNECTED\' NOT NULL',
    );
    expect(migrationSql).toContain(
      'ADD COLUMN "disconnected_at" timestamp with time zone',
    );
  });

  it('ties connection_status to the credential envelope with a single consistency check', () => {
    expect(migrationSql).toContain(
      'CONSTRAINT "provider_connections_status_credential_consistent" CHECK',
    );
    expect(migrationSql).toContain('\'CONNECTED\'');
    expect(migrationSql).toContain('\'DISCONNECTED\'');
    expect(migrationSql).not.toMatch(/password|secret|plaintext/iu);
  });
});
