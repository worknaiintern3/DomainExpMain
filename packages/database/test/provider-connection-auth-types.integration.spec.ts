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

const AUTH_TYPES = [
  'CLOUDFLARE_API_TOKEN',
  'GODADDY_PAT',
  'NAMECHEAP_API_KEY',
  'HOSTINGER_API_TOKEN',
] as const;

function envelope() {
  return {
    encryptedCiphertext: 'dGVzdA==',
    encryptionAuthTag: 'AAAAAAAAAAAAAAAAAAAAAA==',
    encryptionIv: 'AAAAAAAAAAAAAAAA',
    keyVersion: 1,
  };
}

describeWithPostgres(
  'migration 0014 provider_connection_auth_type — real PostgreSQL',
  () => {
    let client: DatabaseClient | undefined;
    const workspaceId = randomUUID();

    const getClient = (): DatabaseClient => {
      if (!client) throw new Error('Auth-type migration test client was not initialized');
      return client;
    };

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, { migrationsFolder: './migrations' });
      await client.database.insert(workspaces).values({
        id: workspaceId,
        name: 'Provider Auth Type Migration Test',
        slug: `provider-auth-types-${workspaceId}`,
      });
    });

    afterAll(async () => {
      if (!client) return;
      await client.database.delete(providerConnections).where(eq(providerConnections.workspaceId, workspaceId));
      await client.database.delete(providerAccounts).where(eq(providerAccounts.workspaceId, workspaceId));
      await client.database.delete(workspaces).where(eq(workspaces.id, workspaceId));
      await client.close();
    });

    it('the enum contains exactly the four expected values after 0014, in order, with no rewrite of existing labels', async () => {
      const result = await getClient().pool.query<{ enumlabel: string }>(
        `select e.enumlabel
         from pg_type t
         join pg_enum e on e.enumtypid = t.oid
         where t.typname = 'provider_connection_auth_type'
         order by e.enumsortorder`,
      );
      expect(result.rows.map((row) => row.enumlabel)).toEqual([
        'CLOUDFLARE_API_TOKEN',
        'GODADDY_PAT',
        'NAMECHEAP_API_KEY',
        'HOSTINGER_API_TOKEN',
      ]);
    });

    it.each(AUTH_TYPES)(
      'a new provider_connections row can persist auth type %s and read back unchanged',
      async (authType) => {
        const providerAccountId = randomUUID();
        const connectionId = randomUUID();
        const now = new Date();

        await getClient().database.insert(providerAccounts).values({
          id: providerAccountId,
          label: `${authType} test account`,
          provenance: 'USER_ADDED',
          providerKey: authType.toLowerCase(),
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

    it('the pre-existing CLOUDFLARE_API_TOKEN row (created before 0014) remains valid and unaffected by the additive migration', async () => {
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
