import { randomUUID } from 'node:crypto';

import {
  createDatabaseClient,
  inventoryNodes,
  providerAccounts,
  providerConnections,
  providerResourceLinks,
  servers,
  workspaces,
  type DatabaseClient,
} from '@domainpulse/database';
import { and, eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ProviderServerDiscovery } from '../src/providers/provider-adapter.types';
import { PostgresProviderServerReconciliationStore } from '../src/providers/reconciliation/provider-server-reconciliation.repository';
import { ProviderServerReconciler } from '../src/providers/reconciliation/provider-server-reconciliation.service';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
  resolveMigrationsFolder,
} from './alert-integration-helpers';

const describeWithPostgres = hasDisposableTestDatabase ? describe : describe.skip;
const workspaceId = randomUUID();
const providerAccountId = randomUUID();
const connectionId = randomUUID();
const existingServerId = randomUUID();

function discovery(
  serversResult: ProviderServerDiscovery['servers'],
  completion: ProviderServerDiscovery['completion'] = 'COMPLETE',
): ProviderServerDiscovery {
  return {
    completion,
    error: completion === 'PARTIAL'
      ? { code: 'UPSTREAM_UNAVAILABLE', retryAfterSeconds: null }
      : null,
    externalResourceType: 'digitalocean.droplet',
    servers: serversResult,
  };
}

describeWithPostgres('provider server reconciliation — real PostgreSQL', () => {
  let client: DatabaseClient | undefined;
  let reconciler: ProviderServerReconciler | undefined;

  const getClient = (): DatabaseClient => {
    if (!client) throw new Error('Provider reconciliation test client was not initialized');
    return client;
  };

  const getReconciler = (): ProviderServerReconciler => {
    if (!reconciler) throw new Error('Provider reconciler was not initialized');
    return reconciler;
  };

  beforeAll(async () => {
    client = createDatabaseClient(getDisposableTestConfiguration());
    await migrate(client.database, { migrationsFolder: resolveMigrationsFolder() });
    await client.database.insert(workspaces).values({
      id: workspaceId,
      name: 'VPS Provider Reconciliation Test',
      slug: `provider-vps-reconciliation-${workspaceId}`,
    });
    await client.database.insert(providerAccounts).values({
      id: providerAccountId,
      label: 'DigitalOcean test account',
      provenance: 'USER_ADDED',
      providerKey: 'digitalocean',
      workspaceId,
    });
    await client.database.insert(providerConnections).values({
      authType: 'DIGITALOCEAN_API_TOKEN',
      credentialMask: 'test-token-mask',
      encryptedCiphertext: 'dGVzdA==',
      encryptionAuthTag: 'AAAAAAAAAAAAAAAAAAAAAA==',
      encryptionIv: 'AAAAAAAAAAAAAAAA',
      id: connectionId,
      keyVersion: 1,
      providerAccountId,
      workspaceId,
    });
    await client.database.insert(servers).values({
      id: existingServerId,
      name: 'user-added-web-1',
      primaryIp: '93.184.216.34',
      provenance: 'USER_ADDED',
      workspaceId,
    });
    reconciler = new ProviderServerReconciler(
      new PostgresProviderServerReconciliationStore(client),
    );
  });

  afterAll(async () => {
    if (!client) return;
    await client.database.delete(providerResourceLinks).where(
      eq(providerResourceLinks.workspaceId, workspaceId),
    );
    await client.database.delete(providerConnections).where(
      eq(providerConnections.workspaceId, workspaceId),
    );
    await client.database.delete(servers).where(eq(servers.workspaceId, workspaceId));
    await client.database.delete(providerAccounts).where(
      eq(providerAccounts.workspaceId, workspaceId),
    );
    await client.database.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await client.close();
  });

  it('links to a compatible existing server by IP, creates new ones, and cycles through partial/missing/reappearance', async () => {
    const initialAt = new Date('2026-09-15T00:00:00.000Z');
    const initial = await getReconciler().reconcile({
      connectionId,
      discovery: discovery([
        {
          canonicalName: 'existing-in-provider',
          externalResourceId: 'droplet-existing',
          hostname: null,
          operatingSystem: 'ubuntu-22-04-x64',
          primaryIp: '93.184.216.34',
          providerStatus: 'active',
          region: 'nyc3',
          serverKind: 's-1vcpu-1gb',
        },
        {
          canonicalName: 'new-server',
          externalResourceId: 'droplet-new',
          hostname: null,
          operatingSystem: 'ubuntu-22-04-x64',
          primaryIp: '93.184.216.35',
          providerStatus: 'active',
          region: 'nyc3',
          serverKind: 's-1vcpu-1gb',
        },
      ]),
      providerKey: 'digitalocean',
      synchronizedAt: initialAt,
      workspaceId,
    });
    expect(initial).toEqual({
      itemsCreated: 2,
      itemsDiscovered: 2,
      itemsMissing: 0,
      itemsUnchanged: 0,
      itemsUpdated: 0,
    });

    const persistedServers = await getClient().database
      .select()
      .from(servers)
      .where(eq(servers.workspaceId, workspaceId));
    // Attached to the existing row, not duplicated: still exactly 2 total.
    expect(persistedServers).toHaveLength(2);
    expect(persistedServers.find(({ id }) => id === existingServerId)).toMatchObject({
      // The user's own name is preserved -- reconciliation never overwrites it.
      name: 'user-added-web-1',
      provenance: 'USER_ADDED',
    });
    expect(persistedServers.find(({ primaryIp }) => primaryIp === '93.184.216.35'))
      .toMatchObject({ name: 'new-server', provenance: 'PROVIDER_API' });

    const links = await getClient().database
      .select({
        entityId: inventoryNodes.entityId,
        entityKind: inventoryNodes.entityKind,
        externalResourceId: providerResourceLinks.externalResourceId,
        status: providerResourceLinks.status,
      })
      .from(providerResourceLinks)
      .innerJoin(
        inventoryNodes,
        and(
          eq(inventoryNodes.workspaceId, providerResourceLinks.workspaceId),
          eq(inventoryNodes.nodeId, providerResourceLinks.nodeId),
        ),
      )
      .where(eq(providerResourceLinks.workspaceId, workspaceId));
    expect(links).toHaveLength(2);
    expect(links.every(({ entityKind }) => entityKind === 'SERVER')).toBe(true);
    expect(links.find(({ externalResourceId }) => externalResourceId === 'droplet-existing'))
      .toMatchObject({ entityId: existingServerId, status: 'ACTIVE' });

    await getReconciler().reconcile({
      connectionId,
      discovery: discovery([], 'PARTIAL'),
      providerKey: 'digitalocean',
      synchronizedAt: new Date(initialAt.getTime() + 1_000),
      workspaceId,
    });
    expect(await getClient().database.select().from(providerResourceLinks).where(
      and(
        eq(providerResourceLinks.workspaceId, workspaceId),
        eq(providerResourceLinks.status, 'MISSING_FROM_PROVIDER'),
      ),
    )).toHaveLength(0);

    const missingAt = new Date(initialAt.getTime() + 2_000);
    const missing = await getReconciler().reconcile({
      connectionId,
      discovery: discovery([]),
      providerKey: 'digitalocean',
      synchronizedAt: missingAt,
      workspaceId,
    });
    expect(missing.itemsMissing).toBe(2);
    // A missing provider link never hard-deletes the underlying server row.
    expect(await getClient().database.select().from(servers).where(
      eq(servers.workspaceId, workspaceId),
    )).toHaveLength(2);

    const reappearedAt = new Date(initialAt.getTime() + 3_000);
    await getReconciler().reconcile({
      connectionId,
      discovery: discovery([{
        canonicalName: 'new-server',
        externalResourceId: 'droplet-new',
        hostname: null,
        operatingSystem: 'ubuntu-22-04-x64',
        primaryIp: '93.184.216.35',
        providerStatus: 'active',
        region: 'nyc3',
        serverKind: 's-1vcpu-1gb',
      }]),
      providerKey: 'digitalocean',
      synchronizedAt: reappearedAt,
      workspaceId,
    });
    const [reappeared] = await getClient().database
      .select()
      .from(providerResourceLinks)
      .where(
        and(
          eq(providerResourceLinks.workspaceId, workspaceId),
          eq(providerResourceLinks.externalResourceId, 'droplet-new'),
        ),
      );
    expect(reappeared).toMatchObject({
      lastSeenAt: reappearedAt,
      missingSince: null,
      status: 'ACTIVE',
    });
  });

  it('two concurrent syncs racing to create the same resource link never duplicate the row', async () => {
    const at = new Date('2026-09-16T00:00:00.000Z');
    const raceDiscovery = discovery([
      {
        canonicalName: 'race-server',
        externalResourceId: 'droplet-race',
        hostname: null,
        operatingSystem: 'ubuntu-22-04-x64',
        primaryIp: '93.184.216.99',
        providerStatus: 'active',
        region: 'nyc3',
        serverKind: 's-1vcpu-1gb',
      },
    ]);

    const results = await Promise.all([
      getReconciler().reconcile({ connectionId, discovery: raceDiscovery, providerKey: 'digitalocean', synchronizedAt: at, workspaceId }),
      getReconciler().reconcile({ connectionId, discovery: raceDiscovery, providerKey: 'digitalocean', synchronizedAt: at, workspaceId }),
    ]);

    expect(results.map((r) => r.itemsCreated + r.itemsUpdated + r.itemsUnchanged)).toEqual([1, 1]);
    expect(results.reduce((sum, r) => sum + r.itemsCreated, 0)).toBe(1);

    const rows = await getClient().database
      .select()
      .from(providerResourceLinks)
      .where(
        and(
          eq(providerResourceLinks.workspaceId, workspaceId),
          eq(providerResourceLinks.externalResourceId, 'droplet-race'),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'ACTIVE' });
  });

  it('repeating an identical sync is idempotent: no new server rows, everything reported unchanged', async () => {
    const at = new Date('2026-09-16T01:00:00.000Z');
    const stableDiscovery = discovery([
      {
        canonicalName: 'stable-server',
        externalResourceId: 'droplet-stable',
        hostname: null,
        operatingSystem: 'ubuntu-22-04-x64',
        primaryIp: '93.184.216.88',
        providerStatus: 'active',
        region: 'nyc3',
        serverKind: 's-1vcpu-1gb',
      },
    ]);

    const first = await getReconciler().reconcile({
      connectionId, discovery: stableDiscovery, providerKey: 'digitalocean', synchronizedAt: at, workspaceId,
    });
    expect(first).toMatchObject({ itemsCreated: 1, itemsUpdated: 0 });

    const serversBefore = await getClient().database.select().from(servers).where(eq(servers.workspaceId, workspaceId));
    const linksBefore = await getClient().database.select().from(providerResourceLinks).where(eq(providerResourceLinks.workspaceId, workspaceId));

    const second = await getReconciler().reconcile({
      connectionId,
      discovery: { ...stableDiscovery, servers: stableDiscovery.servers.map((entry) => ({ ...entry })) },
      providerKey: 'digitalocean',
      synchronizedAt: new Date(at.getTime() + 1_000),
      workspaceId,
    });
    expect(second).toMatchObject({ itemsCreated: 0, itemsUpdated: 0, itemsUnchanged: 1 });

    const serversAfter = await getClient().database.select().from(servers).where(eq(servers.workspaceId, workspaceId));
    const linksAfter = await getClient().database.select().from(providerResourceLinks).where(eq(providerResourceLinks.workspaceId, workspaceId));
    expect(serversAfter).toHaveLength(serversBefore.length);
    expect(linksAfter).toHaveLength(linksBefore.length);
  });
});
