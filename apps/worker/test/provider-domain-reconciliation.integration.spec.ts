import { randomUUID } from 'node:crypto';

import {
  createDatabaseClient,
  domains,
  inventoryNodes,
  providerAccounts,
  providerConnections,
  providerResourceLinks,
  workspaces,
  type DatabaseClient,
} from '@domainpulse/database';
import { and, eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ProviderDomainReconciler } from '../src/providers/reconciliation/provider-domain-reconciliation.service';
import { PostgresProviderDomainReconciliationStore } from '../src/providers/reconciliation/provider-domain-reconciliation.repository';
import type { ProviderDomainDiscovery } from '../src/providers/provider-adapter.types';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
  resolveMigrationsFolder,
} from './alert-integration-helpers';

const describeWithPostgres = hasDisposableTestDatabase ? describe : describe.skip;
const workspaceId = randomUUID();
const providerAccountId = randomUUID();
const connectionId = randomUUID();
const existingDomainId = randomUUID();

function discovery(
  domainsResult: ProviderDomainDiscovery['domains'],
  completion: ProviderDomainDiscovery['completion'] = 'COMPLETE',
): ProviderDomainDiscovery {
  return {
    completion,
    domains: domainsResult,
    error: completion === 'PARTIAL'
      ? { code: 'UPSTREAM_UNAVAILABLE', retryAfterSeconds: null }
      : null,
    externalResourceType: 'cloudflare.zone',
  };
}

describeWithPostgres('provider domain reconciliation — real PostgreSQL', () => {
  let client: DatabaseClient | undefined;
  let reconciler: ProviderDomainReconciler | undefined;

  const getClient = (): DatabaseClient => {
    if (!client) throw new Error('Provider reconciliation test client was not initialized');
    return client;
  };

  const getReconciler = (): ProviderDomainReconciler => {
    if (!reconciler) throw new Error('Provider reconciler was not initialized');
    return reconciler;
  };

  beforeAll(async () => {
    client = createDatabaseClient(getDisposableTestConfiguration());
    await migrate(client.database, { migrationsFolder: resolveMigrationsFolder() });
    await client.database.insert(workspaces).values({
      id: workspaceId,
      name: 'Provider Reconciliation Test',
      slug: `provider-reconciliation-${workspaceId}`,
    });
    await client.database.insert(providerAccounts).values({
      id: providerAccountId,
      label: 'Cloudflare test account',
      provenance: 'USER_ADDED',
      providerKey: 'cloudflare',
      workspaceId,
    });
    await client.database.insert(providerConnections).values({
      authType: 'CLOUDFLARE_API_TOKEN',
      credentialMask: 'test-token-mask',
      encryptedCiphertext: 'dGVzdA==',
      encryptionAuthTag: 'AAAAAAAAAAAAAAAAAAAAAA==',
      encryptionIv: 'AAAAAAAAAAAAAAAA',
      id: connectionId,
      keyVersion: 1,
      providerAccountId,
      workspaceId,
    });
    await client.database.insert(domains).values({
      domainName: 'b\u00fccher.example',
      id: existingDomainId,
      normalizedDomainName: 'xn--bcher-kva.example',
      provenance: 'USER_ADDED',
      workspaceId,
    });
    reconciler = new ProviderDomainReconciler(
      new PostgresProviderDomainReconciliationStore(client),
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
    await client.database.delete(domains).where(eq(domains.workspaceId, workspaceId));
    await client.database.delete(providerAccounts).where(
      eq(providerAccounts.workspaceId, workspaceId),
    );
    await client.database.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await client.close();
  });

  it('creates and links domains conservatively across complete, partial, missing, and reappearance cycles', async () => {
    const initialAt = new Date('2026-09-15T00:00:00.000Z');
    const initial = await getReconciler().reconcile({
      connectionId,
      discovery: discovery([
        {
          canonicalDomain: 'xn--bcher-kva.example',
          dnsHostedByProvider: true,
          externalResourceId: 'cloudflare-zone-existing',
          providerStatus: 'active',
        },
        {
          canonicalDomain: 'new.example',
          dnsHostedByProvider: false,
          externalResourceId: 'cloudflare-zone-new',
          providerStatus: 'pending',
        },
      ]),
      providerKey: 'cloudflare',
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

    const persistedDomains = await getClient().database
      .select()
      .from(domains)
      .where(eq(domains.workspaceId, workspaceId));
    expect(persistedDomains).toHaveLength(2);
    expect(persistedDomains.find(({ id }) => id === existingDomainId)).toMatchObject({
      dnsProviderAccountId: providerAccountId,
      provenance: 'USER_ADDED',
    });
    expect(persistedDomains.find(({ normalizedDomainName }) => normalizedDomainName === 'new.example'))
      .toMatchObject({ dnsProviderAccountId: null, provenance: 'PROVIDER_API' });

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
    expect(links.every(({ entityKind }) => entityKind === 'DOMAIN')).toBe(true);
    expect(links.find(({ externalResourceId }) => externalResourceId === 'cloudflare-zone-existing'))
      .toMatchObject({ entityId: existingDomainId, status: 'ACTIVE' });

    await getReconciler().reconcile({
      connectionId,
      discovery: discovery([], 'PARTIAL'),
      providerKey: 'cloudflare',
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
      providerKey: 'cloudflare',
      synchronizedAt: missingAt,
      workspaceId,
    });
    expect(missing.itemsMissing).toBe(2);

    const reappearedAt = new Date(initialAt.getTime() + 3_000);
    await getReconciler().reconcile({
      connectionId,
      discovery: discovery([{
        canonicalDomain: 'new.example',
        dnsHostedByProvider: true,
        externalResourceId: 'cloudflare-zone-new',
        providerStatus: 'active',
      }]),
      providerKey: 'cloudflare',
      synchronizedAt: reappearedAt,
      workspaceId,
    });
    const [reappeared] = await getClient().database
      .select()
      .from(providerResourceLinks)
      .where(
        and(
          eq(providerResourceLinks.workspaceId, workspaceId),
          eq(providerResourceLinks.externalResourceId, 'cloudflare-zone-new'),
        ),
      );
    expect(reappeared).toMatchObject({
      lastSeenAt: reappearedAt,
      missingSince: null,
      status: 'ACTIVE',
    });
    expect(await getClient().database.select().from(domains).where(
      eq(domains.workspaceId, workspaceId),
    )).toHaveLength(2);
  });
});
