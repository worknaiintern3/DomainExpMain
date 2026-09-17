import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type { DatabaseClient } from '../src/client/database-types';
import {
  providerAccounts,
  providerConnections,
  workspaces,
} from '../src/schema';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgres = hasDisposableTestDatabase ? describe : describe.skip;

/**
 * The integrated Phase 10J migration chain adds these in three additive
 * steps, in this exact order: 0014 (Phase 10G domain/registrar auth types,
 * pre-existing before this branch), 0015 (Phase 10H VPS auth types), 0016
 * (Phase 10I cloud auth types, generated fresh against the 0015 baseline
 * during 10H+10I integration -- see 0016_cloud_provider_auth_types.sql).
 * `pg_enum.enumsortorder` reflects that exact addition order, so the
 * real-database assertion below must too.
 */
const DOMAIN_AUTH_TYPES = [
  'CLOUDFLARE_API_TOKEN',
  'GODADDY_PAT',
  'NAMECHEAP_API_KEY',
  'HOSTINGER_API_TOKEN',
] as const;

const VPS_AUTH_TYPES = [
  'DIGITALOCEAN_API_TOKEN',
  'HETZNER_API_TOKEN',
  'VULTR_API_KEY',
  'LINODE_API_TOKEN',
] as const;

const CLOUD_AUTH_TYPES = [
  'AWS_ACCESS_KEY',
  'GCP_SERVICE_ACCOUNT_KEY',
  'AZURE_CLIENT_CREDENTIALS',
] as const;

const CLOUD_PROVIDER_KEY: Record<(typeof CLOUD_AUTH_TYPES)[number], string> = {
  AWS_ACCESS_KEY: 'aws',
  AZURE_CLIENT_CREDENTIALS: 'azure',
  GCP_SERVICE_ACCOUNT_KEY: 'gcp',
};

/** One VPS auth type's persistence is asserted below (see the 10H VPS auth-type migration spec for full VPS coverage) -- this file's job is proving the *integrated enum* is coherent, not re-testing every VPS value. */
const SAMPLE_VPS_AUTH_TYPE = 'DIGITALOCEAN_API_TOKEN';
const SAMPLE_VPS_PROVIDER_KEY = 'digitalocean';

function envelope() {
  return {
    encryptedCiphertext: 'dGVzdA==',
    encryptionAuthTag: 'AAAAAAAAAAAAAAAAAAAAAA==',
    encryptionIv: 'AAAAAAAAAAAAAAAA',
    keyVersion: 1,
  };
}

describeWithPostgres(
  'integrated provider_connection_auth_type (domain + VPS + cloud) — real PostgreSQL',
  () => {
    let client: DatabaseClient | undefined;
    const workspaceId = randomUUID();

    const getClient = (): DatabaseClient => {
      if (!client) throw new Error('Cloud auth-type migration test client was not initialized');
      return client;
    };

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, { migrationsFolder: './migrations' });
      await client.database.insert(workspaces).values({
        id: workspaceId,
        name: 'Cloud Provider Auth Type Migration Test',
        slug: `cloud-provider-auth-types-${workspaceId}`,
      });
    });

    afterAll(async () => {
      if (!client) return;
      await client.database.delete(providerConnections).where(eq(providerConnections.workspaceId, workspaceId));
      await client.database.delete(providerAccounts).where(eq(providerAccounts.workspaceId, workspaceId));
      await client.database.delete(workspaces).where(eq(workspaces.id, workspaceId));
      await client.close();
    });

    it('the enum contains exactly the four domain values, then the four VPS values, then the three cloud values, in that additive order, with no existing label rewritten', async () => {
      const result = await getClient().pool.query<{ enumlabel: string }>(
        `select e.enumlabel
         from pg_type t
         join pg_enum e on e.enumtypid = t.oid
         where t.typname = 'provider_connection_auth_type'
         order by e.enumsortorder`,
      );
      expect(result.rows.map((row) => row.enumlabel)).toEqual([
        ...DOMAIN_AUTH_TYPES,
        ...VPS_AUTH_TYPES,
        ...CLOUD_AUTH_TYPES,
      ]);
    });

    it('a new provider_connections row can persist a VPS auth type (sampled: DigitalOcean) and read back unchanged', async () => {
      const providerAccountId = randomUUID();
      const connectionId = randomUUID();
      const now = new Date();

      await getClient().database.insert(providerAccounts).values({
        id: providerAccountId,
        label: `${SAMPLE_VPS_AUTH_TYPE} test account`,
        provenance: 'USER_ADDED',
        providerKey: SAMPLE_VPS_PROVIDER_KEY,
        workspaceId,
      });
      await getClient().database.insert(providerConnections).values({
        authType: SAMPLE_VPS_AUTH_TYPE,
        credentialMask: 'test-mask',
        createdAt: now,
        id: connectionId,
        providerAccountId,
        updatedAt: now,
        workspaceId,
        ...envelope(),
      });

      const [persisted] = await getClient().database
        .select({ authType: providerConnections.authType })
        .from(providerConnections)
        .where(
          and(
            eq(providerConnections.workspaceId, workspaceId),
            eq(providerConnections.id, connectionId),
          ),
        );
      expect(persisted?.authType).toBe(SAMPLE_VPS_AUTH_TYPE);
    });

    it.each(CLOUD_AUTH_TYPES)(
      'a new provider_connections row can persist cloud auth type %s and read back unchanged',
      async (authType) => {
        const providerAccountId = randomUUID();
        const connectionId = randomUUID();
        const now = new Date();

        await getClient().database.insert(providerAccounts).values({
          id: providerAccountId,
          label: `${authType} test account`,
          provenance: 'USER_ADDED',
          providerKey: CLOUD_PROVIDER_KEY[authType],
          workspaceId,
        });
        await getClient().database.insert(providerConnections).values({
          authType,
          credentialMask: 'test-mask',
          createdAt: now,
          id: connectionId,
          providerAccountId,
          updatedAt: now,
          workspaceId,
          ...envelope(),
        });

        const [persisted] = await getClient().database
          .select({ authType: providerConnections.authType })
          .from(providerConnections)
          .where(
            and(
              eq(providerConnections.workspaceId, workspaceId),
              eq(providerConnections.id, connectionId),
            ),
          );
        expect(persisted?.authType).toBe(authType);
      },
    );

    it('a pre-existing registrar auth type (CLOUDFLARE_API_TOKEN) remains valid and unaffected by the later additive 0015/0016 migrations', async () => {
      const providerAccountId = randomUUID();
      const connectionId = randomUUID();
      const now = new Date();

      await getClient().database.insert(providerAccounts).values({
        id: providerAccountId,
        label: 'Pre-existing Cloudflare account',
        provenance: 'USER_ADDED',
        providerKey: 'cloudflare',
        workspaceId,
      });
      await getClient().database.insert(providerConnections).values({
        authType: 'CLOUDFLARE_API_TOKEN',
        credentialMask: 'test-mask',
        createdAt: now,
        id: connectionId,
        providerAccountId,
        updatedAt: now,
        workspaceId,
        ...envelope(),
      });

      const [persisted] = await getClient().database
        .select({ authType: providerConnections.authType, connectionStatus: providerConnections.connectionStatus })
        .from(providerConnections)
        .where(eq(providerConnections.id, connectionId));
      expect(persisted).toMatchObject({ authType: 'CLOUDFLARE_API_TOKEN', connectionStatus: 'CONNECTED' });
    });
  },
);
