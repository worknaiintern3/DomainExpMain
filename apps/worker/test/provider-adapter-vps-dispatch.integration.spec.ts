import { randomUUID } from 'node:crypto';

import {
  createDatabaseClient,
  encryptProviderCredential,
  providerAccounts,
  providerConnections,
  providerResourceLinks,
  servers,
  workspaces,
  type DatabaseClient,
  type ProviderCredentialKeyStore,
} from '@domainpulse/database';
import { and, eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DigitalOceanAdapter } from '../src/providers/digitalocean/digitalocean.adapter';
import { DIGITALOCEAN_PROVIDER_KEY } from '../src/providers/digitalocean/digitalocean.constants';
import { HetznerAdapter } from '../src/providers/hetzner/hetzner.adapter';
import { HETZNER_PROVIDER_KEY } from '../src/providers/hetzner/hetzner.constants';
import { LinodeAdapter } from '../src/providers/linode/linode.adapter';
import { LINODE_PROVIDER_KEY } from '../src/providers/linode/linode.constants';
import type { ProviderAdapter, ServerDiscoveryCapability } from '../src/providers/provider-adapter.types';
import { PostgresProviderServerReconciliationStore } from '../src/providers/reconciliation/provider-server-reconciliation.repository';
import { ProviderServerReconciler, ProviderServerSyncService } from '../src/providers/reconciliation/provider-server-reconciliation.service';
import { ProviderSyncExecutor } from '../src/providers/sync/provider-sync.executor';
import type { ClaimedProviderSyncRun, ProviderResourceSyncService } from '../src/providers/sync/provider-sync.types';
import { VultrAdapter } from '../src/providers/vultr/vultr.adapter';
import { VULTR_PROVIDER_KEY } from '../src/providers/vultr/vultr.constants';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
  resolveMigrationsFolder,
} from './alert-integration-helpers';

const describeWithPostgres = hasDisposableTestDatabase ? describe : describe.skip;

const keyStore: ProviderCredentialKeyStore = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 11)]]),
};

function fakeJsonResponse(value: unknown): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  return new Response(JSON.stringify(value), { headers });
}

interface ProviderFixture {
  readonly adapter: ProviderAdapter & ServerDiscoveryCapability;
  readonly authType: 'DIGITALOCEAN_API_TOKEN' | 'HETZNER_API_TOKEN' | 'VULTR_API_KEY' | 'LINODE_API_TOKEN';
  readonly credential: string;
  readonly providerKey: string;
}

const digitaloceanFixture: ProviderFixture = {
  adapter: new DigitalOceanAdapter({
    fetchImplementation: (async () =>
      fakeJsonResponse({
        droplets: [{
          created_at: '2026-01-01T00:00:00Z',
          id: 1,
          image: { slug: 'ubuntu-22-04-x64' },
          name: 'do-e2e-droplet',
          networks: { v4: [{ ip_address: '203.0.113.10', type: 'public' }] },
          region: { slug: 'nyc3' },
          size_slug: 's-1vcpu-1gb',
          status: 'active',
        }],
        links: {},
        meta: { total: 1 },
      })) as typeof fetch,
  }),
  authType: 'DIGITALOCEAN_API_TOKEN',
  credential: 'fake-digitalocean-token',
  providerKey: DIGITALOCEAN_PROVIDER_KEY,
};

const hetznerFixture: ProviderFixture = {
  adapter: new HetznerAdapter({
    fetchImplementation: (async () =>
      fakeJsonResponse({
        meta: { pagination: { last_page: 1, next_page: null, page: 1, per_page: 50, total_entries: 1 } },
        servers: [{
          created: '2026-01-01T00:00:00+00:00',
          datacenter: { location: { name: 'fsn1' } },
          id: 1,
          image: { name: 'ubuntu-22.04' },
          name: 'hetzner-e2e-server',
          public_net: { ipv4: { ip: '203.0.113.20' } },
          server_type: { name: 'cx11' },
          status: 'running',
        }],
      })) as typeof fetch,
  }),
  authType: 'HETZNER_API_TOKEN',
  credential: 'fake-hetzner-token',
  providerKey: HETZNER_PROVIDER_KEY,
};

const vultrFixture: ProviderFixture = {
  adapter: new VultrAdapter({
    fetchImplementation: (async () =>
      fakeJsonResponse({
        instances: [{
          date_created: '2026-01-01T00:00:00+00:00',
          hostname: null,
          id: 'vultr-e2e-instance',
          label: 'vultr-e2e-instance',
          main_ip: '93.184.216.30',
          os: 'Ubuntu 22.04 x64',
          plan: 'vc2-1c-1gb',
          power_status: 'running',
          region: 'ewr',
          status: 'active',
        }],
        meta: { links: { next: '' }, total: 1 },
      })) as typeof fetch,
  }),
  authType: 'VULTR_API_KEY',
  credential: 'fake-vultr-key',
  providerKey: VULTR_PROVIDER_KEY,
};

const linodeFixture: ProviderFixture = {
  adapter: new LinodeAdapter({
    fetchImplementation: (async () =>
      fakeJsonResponse({
        data: [{
          created: '2026-01-01T00:00:00',
          id: 1,
          image: 'linode/ubuntu22.04',
          ipv4: ['203.0.113.40'],
          label: 'linode-e2e-instance',
          region: 'us-east',
          status: 'running',
          type: 'g6-standard-1',
        }],
        page: 1,
        pages: 1,
        results: 1,
      })) as typeof fetch,
  }),
  authType: 'LINODE_API_TOKEN',
  credential: 'fake-linode-token',
  providerKey: LINODE_PROVIDER_KEY,
};

describeWithPostgres(
  'provider adapter dispatch — real PostgreSQL (DigitalOcean, Hetzner, Vultr, Linode)',
  () => {
    let client: DatabaseClient | undefined;
    let reconciler: ProviderServerReconciler | undefined;
    const workspaceId = randomUUID();

    const getClient = (): DatabaseClient => {
      if (!client) throw new Error('VPS dispatch test client was not initialized');
      return client;
    };

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, { migrationsFolder: resolveMigrationsFolder() });
      await client.database.insert(workspaces).values({
        id: workspaceId,
        name: 'VPS Provider Dispatch Test',
        slug: `provider-vps-dispatch-${workspaceId}`,
      });
      reconciler = new ProviderServerReconciler(
        new PostgresProviderServerReconciliationStore(client),
      );
    });

    afterAll(async () => {
      if (!client) return;
      await client.database.delete(providerResourceLinks).where(eq(providerResourceLinks.workspaceId, workspaceId));
      await client.database.delete(providerConnections).where(eq(providerConnections.workspaceId, workspaceId));
      await client.database.delete(servers).where(eq(servers.workspaceId, workspaceId));
      await client.database.delete(providerAccounts).where(eq(providerAccounts.workspaceId, workspaceId));
      await client.database.delete(workspaces).where(eq(workspaces.id, workspaceId));
      await client.close();
    });

    it.each([
      ['DigitalOcean', digitaloceanFixture, '203.0.113.10'],
      ['Hetzner', hetznerFixture, '203.0.113.20'],
      ['Vultr', vultrFixture, '93.184.216.30'],
      ['Linode', linodeFixture, '203.0.113.40'],
    ] as const)(
      '%s: a claimed sync dispatches to its own adapter, discovers, and reconciles into real Postgres',
      async (_label, fixture, expectedIp) => {
        const providerAccountId = randomUUID();
        const connectionId = randomUUID();
        const now = new Date();

        await getClient().database.insert(providerAccounts).values({
          id: providerAccountId,
          label: `${fixture.providerKey} test account`,
          provenance: 'USER_ADDED',
          providerKey: fixture.providerKey,
          workspaceId,
        });
        const encrypted = encryptProviderCredential(
          fixture.credential,
          { connectionId, workspaceId },
          keyStore,
        );
        await getClient().database.insert(providerConnections).values({
          authType: fixture.authType,
          credentialMask: 'test-mask',
          encryptedCiphertext: encrypted.ciphertextBase64,
          encryptionAuthTag: encrypted.authTagBase64,
          encryptionIv: encrypted.ivBase64,
          id: connectionId,
          keyVersion: encrypted.keyVersion,
          providerAccountId,
          workspaceId,
        });

        const syncService = new ProviderServerSyncService(fixture.adapter, reconciler!);
        const executor = new ProviderSyncExecutor(
          new Map<string, ProviderResourceSyncService>([[fixture.providerKey, syncService]]),
          keyStore,
        );
        const run: ClaimedProviderSyncRun = {
          attemptNo: 1,
          connectionId,
          idempotencyKey: 'b'.repeat(64),
          leaseExpiresAt: new Date(now.getTime() + 300_000),
          runId: randomUUID(),
          workspaceId,
        };

        const result = await executor.execute(run, {
          connectionStatus: 'CONNECTED',
          encryptedCiphertext: encrypted.ciphertextBase64,
          encryptionAuthTag: encrypted.authTagBase64,
          encryptionIv: encrypted.ivBase64,
          id: connectionId,
          keyVersion: encrypted.keyVersion,
          providerKey: fixture.providerKey,
          workspaceId,
        });

        expect(result).toMatchObject({ itemsCreated: 1, status: 'SUCCESS' });

        const persistedServers = await getClient().database
          .select()
          .from(servers)
          .where(
            and(
              eq(servers.workspaceId, workspaceId),
              eq(servers.primaryIp, expectedIp),
            ),
          );
        expect(persistedServers).toHaveLength(1);
        expect(persistedServers[0]).toMatchObject({ provenance: 'PROVIDER_API' });

        const links = await getClient().database
          .select()
          .from(providerResourceLinks)
          .where(eq(providerResourceLinks.connectionId, connectionId));
        expect(links).toHaveLength(1);
        expect(links[0]).toMatchObject({ status: 'ACTIVE' });
      },
    );

    it('a connection whose provider account belongs to a different provider is never dispatched to the wrong adapter', async () => {
      const providerAccountId = randomUUID();
      const connectionId = randomUUID();

      // Provider account is DigitalOcean, but the executor's registry is
      // keyed only for Hetzner -- simulates a connection row whose
      // providerKey (resolved via the account, at claim time) does not
      // match any registered adapter: dispatch must fail closed rather than
      // silently reusing a different provider's adapter.
      await getClient().database.insert(providerAccounts).values({
        id: providerAccountId,
        label: 'digitalocean account used for hetzner-only executor',
        provenance: 'USER_ADDED',
        providerKey: DIGITALOCEAN_PROVIDER_KEY,
        workspaceId,
      });
      const encrypted = encryptProviderCredential(
        'fake-digitalocean-token',
        { connectionId, workspaceId },
        keyStore,
      );
      await getClient().database.insert(providerConnections).values({
        authType: 'DIGITALOCEAN_API_TOKEN',
        credentialMask: 'test-mask',
        encryptedCiphertext: encrypted.ciphertextBase64,
        encryptionAuthTag: encrypted.authTagBase64,
        encryptionIv: encrypted.ivBase64,
        id: connectionId,
        keyVersion: encrypted.keyVersion,
        providerAccountId,
        workspaceId,
      });

      const executor = new ProviderSyncExecutor(
        new Map<string, ProviderResourceSyncService>([
          [HETZNER_PROVIDER_KEY, new ProviderServerSyncService(hetznerFixture.adapter, reconciler!)],
        ]),
        keyStore,
      );
      const result = await executor.execute(
        {
          attemptNo: 1,
          connectionId,
          idempotencyKey: 'c'.repeat(64),
          leaseExpiresAt: new Date(Date.now() + 300_000),
          runId: randomUUID(),
          workspaceId,
        },
        {
          connectionStatus: 'CONNECTED',
          encryptedCiphertext: encrypted.ciphertextBase64,
          encryptionAuthTag: encrypted.authTagBase64,
          encryptionIv: encrypted.ivBase64,
          id: connectionId,
          keyVersion: encrypted.keyVersion,
          providerKey: DIGITALOCEAN_PROVIDER_KEY,
          workspaceId,
        },
      );

      expect(result).toMatchObject({ errorCode: 'UNKNOWN_PROVIDER_ERROR', status: 'FAILED' });
      expect(await getClient().database.select().from(servers).where(eq(servers.workspaceId, workspaceId)))
        .not.toContainEqual(expect.objectContaining({ name: expect.stringContaining('digitalocean') }));
    });
  },
);
