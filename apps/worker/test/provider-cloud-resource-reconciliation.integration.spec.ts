import { randomUUID } from 'node:crypto';

import {
  cloudResources,
  createDatabaseClient,
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

import type { DiscoveredCloudResource, ProviderCloudResourceDiscovery } from '../src/providers/cloud-resource-adapter.types';
import { PostgresProviderCloudResourceReconciliationStore } from '../src/providers/reconciliation/provider-cloud-resource-reconciliation.repository';
import { ProviderCloudResourceReconciler } from '../src/providers/reconciliation/provider-cloud-resource-reconciliation.service';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
  resolveMigrationsFolder,
} from './alert-integration-helpers';

const describeWithPostgres = hasDisposableTestDatabase ? describe : describe.skip;

function resource(id: string, overrides: Partial<DiscoveredCloudResource> = {}): DiscoveredCloudResource {
  return {
    externalResourceId: id,
    imageReference: 'ami-123',
    instanceType: 't3.micro',
    launchedAt: null,
    name: `instance-${id}`,
    privateIpAddress: '10.0.0.1',
    providerStatus: 'running',
    publicIpAddress: '1.2.3.4',
    region: 'us-east-1',
    resourceGroup: null,
    resourceKind: 'ec2-instance',
    tags: { Name: `instance-${id}` },
    zone: 'us-east-1a',
    ...overrides,
  };
}

function discovery(
  resources: readonly DiscoveredCloudResource[],
  completion: 'COMPLETE' | 'PARTIAL' = 'COMPLETE',
  externalResourceType = 'ec2-instance',
): ProviderCloudResourceDiscovery {
  return {
    completion,
    error: completion === 'PARTIAL' ? { code: 'UPSTREAM_UNAVAILABLE', retryAfterSeconds: null } : null,
    externalResourceType,
    resources,
  };
}

describeWithPostgres('provider cloud resource reconciliation — real PostgreSQL', () => {
  let client: DatabaseClient | undefined;
  let reconciler: ProviderCloudResourceReconciler | undefined;
  const workspaceId = randomUUID();
  const providerAccountId = randomUUID();
  const connectionId = randomUUID();

  const getClient = (): DatabaseClient => {
    if (!client) throw new Error('Cloud reconciliation test client was not initialized');
    return client;
  };
  const getReconciler = (): ProviderCloudResourceReconciler => {
    if (!reconciler) throw new Error('Cloud resource reconciler was not initialized');
    return reconciler;
  };

  async function createWorkspaceWithConnection(
    label: string,
    providerKey: string,
    authType: 'AWS_ACCESS_KEY' | 'GCP_SERVICE_ACCOUNT_KEY' | 'AZURE_CLIENT_CREDENTIALS',
  ): Promise<{ readonly connectionId: string; readonly providerAccountId: string; readonly workspaceId: string }> {
    const ws = randomUUID();
    const account = randomUUID();
    const connection = randomUUID();
    await getClient().database.insert(workspaces).values({ id: ws, name: label, slug: `${label}-${ws}` });
    await getClient().database.insert(providerAccounts).values({
      id: account, label: `${providerKey} test account`, provenance: 'USER_ADDED', providerKey, workspaceId: ws,
    });
    await getClient().database.insert(providerConnections).values({
      authType,
      credentialMask: 'test-mask',
      encryptedCiphertext: 'dGVzdA==',
      encryptionAuthTag: 'AAAAAAAAAAAAAAAAAAAAAA==',
      encryptionIv: 'AAAAAAAAAAAAAAAA',
      id: connection,
      keyVersion: 1,
      providerAccountId: account,
      workspaceId: ws,
    });
    return { connectionId: connection, providerAccountId: account, workspaceId: ws };
  }

  async function deleteWorkspaceCascade(ws: string): Promise<void> {
    await getClient().database.delete(providerResourceLinks).where(eq(providerResourceLinks.workspaceId, ws));
    await getClient().database.delete(cloudResources).where(eq(cloudResources.workspaceId, ws));
    await getClient().database.delete(providerConnections).where(eq(providerConnections.workspaceId, ws));
    await getClient().database.delete(providerAccounts).where(eq(providerAccounts.workspaceId, ws));
    await getClient().database.delete(workspaces).where(eq(workspaces.id, ws));
  }

  beforeAll(async () => {
    client = createDatabaseClient(getDisposableTestConfiguration());
    await migrate(client.database, { migrationsFolder: resolveMigrationsFolder() });
    await client.database.insert(workspaces).values({
      id: workspaceId,
      name: 'Cloud Reconciliation Test',
      slug: `cloud-reconciliation-${workspaceId}`,
    });
    await client.database.insert(providerAccounts).values({
      id: providerAccountId,
      label: 'AWS test account',
      provenance: 'USER_ADDED',
      providerKey: 'aws',
      workspaceId,
    });
    await client.database.insert(providerConnections).values({
      authType: 'AWS_ACCESS_KEY',
      credentialMask: 'test-mask',
      encryptedCiphertext: 'dGVzdA==',
      encryptionAuthTag: 'AAAAAAAAAAAAAAAAAAAAAA==',
      encryptionIv: 'AAAAAAAAAAAAAAAA',
      id: connectionId,
      keyVersion: 1,
      providerAccountId,
      workspaceId,
    });
    reconciler = new ProviderCloudResourceReconciler(
      new PostgresProviderCloudResourceReconciliationStore(client),
    );
  });

  afterAll(async () => {
    if (!client) return;
    await deleteWorkspaceCascade(workspaceId);
    await client.close();
  });

  it('creates a cloud resource with PROVIDER_API provenance and an active resource link', async () => {
    const at = new Date('2026-09-15T00:00:00.000Z');
    const result = await getReconciler().reconcile({
      connectionId,
      discovery: discovery([resource('i-create')]),
      providerKey: 'aws',
      synchronizedAt: at,
      workspaceId,
    });
    expect(result).toEqual({ itemsCreated: 1, itemsDiscovered: 1, itemsMissing: 0, itemsUnchanged: 0, itemsUpdated: 0 });

    const [persisted] = await getClient().database
      .select()
      .from(cloudResources)
      .where(and(eq(cloudResources.workspaceId, workspaceId), eq(cloudResources.externalResourceId, 'i-create')));
    expect(persisted).toMatchObject({ name: 'instance-i-create', provenance: 'PROVIDER_API', region: 'us-east-1' });

    const links = await getClient().database
      .select({ entityId: inventoryNodes.entityId, entityKind: inventoryNodes.entityKind, status: providerResourceLinks.status })
      .from(providerResourceLinks)
      .innerJoin(inventoryNodes, and(
        eq(inventoryNodes.workspaceId, providerResourceLinks.workspaceId),
        eq(inventoryNodes.nodeId, providerResourceLinks.nodeId),
      ))
      .where(and(eq(providerResourceLinks.workspaceId, workspaceId), eq(providerResourceLinks.externalResourceId, 'i-create')));
    expect(links).toEqual([{ entityId: persisted!.id, entityKind: 'CLOUD_RESOURCE', status: 'ACTIVE' }]);
  });

  it('repeating an identical sync is idempotent: no new rows, everything reported unchanged', async () => {
    const at = new Date('2026-09-15T01:00:00.000Z');
    const stable = discovery([resource('i-stable')]);
    const first = await getReconciler().reconcile({ connectionId, discovery: stable, providerKey: 'aws', synchronizedAt: at, workspaceId });
    expect(first).toMatchObject({ itemsCreated: 1, itemsUpdated: 0 });

    const before = await getClient().database.select().from(cloudResources).where(eq(cloudResources.workspaceId, workspaceId));
    const linksBefore = await getClient().database.select().from(providerResourceLinks).where(eq(providerResourceLinks.workspaceId, workspaceId));

    const second = await getReconciler().reconcile({
      connectionId,
      discovery: { ...stable, resources: stable.resources.map((r) => ({ ...r })) },
      providerKey: 'aws',
      synchronizedAt: new Date(at.getTime() + 1_000),
      workspaceId,
    });
    expect(second).toMatchObject({ itemsCreated: 0, itemsUpdated: 0 });

    const after = await getClient().database.select().from(cloudResources).where(eq(cloudResources.workspaceId, workspaceId));
    const linksAfter = await getClient().database.select().from(providerResourceLinks).where(eq(providerResourceLinks.workspaceId, workspaceId));
    expect(after).toHaveLength(before.length);
    expect(linksAfter).toHaveLength(linksBefore.length);
  });

  it('COMPLETE marks an unseen resource link missing; PARTIAL never does; reappearance reactivates it', async () => {
    const at = new Date('2026-09-15T02:00:00.000Z');
    await getReconciler().reconcile({ connectionId, discovery: discovery([resource('i-cycle')]), providerKey: 'aws', synchronizedAt: at, workspaceId });

    const afterPartial = await getReconciler().reconcile({
      connectionId, discovery: discovery([], 'PARTIAL'), providerKey: 'aws', synchronizedAt: new Date(at.getTime() + 1_000), workspaceId,
    });
    expect(afterPartial.itemsMissing).toBe(0);
    const [stillActive] = await getClient().database.select().from(providerResourceLinks).where(
      and(eq(providerResourceLinks.workspaceId, workspaceId), eq(providerResourceLinks.externalResourceId, 'i-cycle')),
    );
    expect(stillActive).toMatchObject({ status: 'ACTIVE' });

    const missingAt = new Date(at.getTime() + 2_000);
    const afterComplete = await getReconciler().reconcile({
      connectionId, discovery: discovery([]), providerKey: 'aws', synchronizedAt: missingAt, workspaceId,
    });
    expect(afterComplete.itemsMissing).toBe(1);
    const [missing] = await getClient().database.select().from(providerResourceLinks).where(
      and(eq(providerResourceLinks.workspaceId, workspaceId), eq(providerResourceLinks.externalResourceId, 'i-cycle')),
    );
    expect(missing).toMatchObject({ missingSince: missingAt, status: 'MISSING_FROM_PROVIDER' });

    const reappearedAt = new Date(at.getTime() + 3_000);
    await getReconciler().reconcile({
      connectionId, discovery: discovery([resource('i-cycle')]), providerKey: 'aws', synchronizedAt: reappearedAt, workspaceId,
    });
    const [reactivated] = await getClient().database.select().from(providerResourceLinks).where(
      and(eq(providerResourceLinks.workspaceId, workspaceId), eq(providerResourceLinks.externalResourceId, 'i-cycle')),
    );
    expect(reactivated).toMatchObject({ lastSeenAt: reappearedAt, missingSince: null, status: 'ACTIVE' });
  });

  it('a stale (older-timestamp) sync can never overwrite a newer sync\'s values, even when the newer sync observed no field change', async () => {
    const base = new Date('2026-09-15T03:00:00.000Z').getTime();
    const t0 = new Date(base);
    const t1 = new Date(base + 1_000); // older than t2, but arrives *after* t2 in wall-clock order below
    const t2 = new Date(base + 2_000); // newer than t1

    // T0: initial creation.
    await getReconciler().reconcile({
      connectionId, discovery: discovery([resource('i-watermark', { name: 'v1', region: 'r1' })]), providerKey: 'aws', synchronizedAt: t0, workspaceId,
    });

    // T2 arrives (finishes) first, observing the *same* values as T0 -- this
    // is exactly the audit-flagged case: no field actually changes, but the
    // watermark must still advance to T2.
    await getReconciler().reconcile({
      connectionId, discovery: discovery([resource('i-watermark', { name: 'v1', region: 'r1' })]), providerKey: 'aws', synchronizedAt: t2, workspaceId,
    });
    const [afterT2] = await getClient().database.select().from(cloudResources).where(
      and(eq(cloudResources.workspaceId, workspaceId), eq(cloudResources.externalResourceId, 'i-watermark')),
    );
    expect(afterT2).toMatchObject({ name: 'v1', region: 'r1', updatedAt: t2 });

    // T1 arrives late, carrying different (stale) values and an older
    // synchronizedAt than the now-recorded T2 watermark: it must not
    // mutate the row at all.
    await getReconciler().reconcile({
      connectionId, discovery: discovery([resource('i-watermark', { name: 'STALE', region: 'STALE-REGION' })]), providerKey: 'aws', synchronizedAt: t1, workspaceId,
    });
    const [afterT1] = await getClient().database.select().from(cloudResources).where(
      and(eq(cloudResources.workspaceId, workspaceId), eq(cloudResources.externalResourceId, 'i-watermark')),
    );
    // Watermark and values are exactly as T2 left them -- not rolled back,
    // not overwritten with T1's stale data.
    expect(afterT1).toMatchObject({ name: 'v1', region: 'r1', updatedAt: t2 });

    // The resource link's own monotonic guard (lastSyncedAt, pre-existing
    // and untouched by this fix) must also remain at T2, not regress to T1.
    const [link] = await getClient().database.select().from(providerResourceLinks).where(
      and(eq(providerResourceLinks.workspaceId, workspaceId), eq(providerResourceLinks.externalResourceId, 'i-watermark')),
    );
    expect(link).toMatchObject({ lastSyncedAt: t2 });
  });

  it('the newer-first-then-older ordering also holds when T2 genuinely changes a value (not only the unchanged-value case)', async () => {
    const base = new Date('2026-09-15T04:00:00.000Z').getTime();
    const t0 = new Date(base);
    const t1 = new Date(base + 1_000);
    const t2 = new Date(base + 2_000);

    await getReconciler().reconcile({
      connectionId, discovery: discovery([resource('i-race', { name: 'v1', region: 'r1' })]), providerKey: 'aws', synchronizedAt: t0, workspaceId,
    });
    await getReconciler().reconcile({
      connectionId, discovery: discovery([resource('i-race', { name: 'v2', region: 'r2' })]), providerKey: 'aws', synchronizedAt: t2, workspaceId,
    });
    await getReconciler().reconcile({
      connectionId, discovery: discovery([resource('i-race', { name: 'v1', region: 'r1' })]), providerKey: 'aws', synchronizedAt: t1, workspaceId,
    });

    const [row] = await getClient().database.select().from(cloudResources).where(
      and(eq(cloudResources.workspaceId, workspaceId), eq(cloudResources.externalResourceId, 'i-race')),
    );
    expect(row).toMatchObject({ name: 'v2', region: 'r2', updatedAt: t2 });
  });

  it('workspace isolation: the same externalResourceId in a different workspace never collides or leaks', async () => {
    const other = await createWorkspaceWithConnection('cloud-isolation', 'aws', 'AWS_ACCESS_KEY');
    try {
      const at = new Date('2026-09-15T05:00:00.000Z');
      await getReconciler().reconcile({
        connectionId, discovery: discovery([resource('i-shared-id', { name: 'workspace-1-name' })]), providerKey: 'aws', synchronizedAt: at, workspaceId,
      });
      await getReconciler().reconcile({
        connectionId: other.connectionId, discovery: discovery([resource('i-shared-id', { name: 'workspace-2-name' })]), providerKey: 'aws', synchronizedAt: at, workspaceId: other.workspaceId,
      });

      const rows = await getClient().database.select().from(cloudResources).where(eq(cloudResources.externalResourceId, 'i-shared-id'));
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.workspaceId === workspaceId)).toMatchObject({ name: 'workspace-1-name' });
      expect(rows.find((r) => r.workspaceId === other.workspaceId)).toMatchObject({ name: 'workspace-2-name' });
    } finally {
      await deleteWorkspaceCascade(other.workspaceId);
    }
  });

  it('resource-type isolation: the same externalResourceId under two distinct resourceType buckets are distinct resources', async () => {
    const at = new Date('2026-09-15T06:00:00.000Z');
    await getReconciler().reconcile({
      connectionId, discovery: discovery([resource('i-type-a', { resourceKind: 'ec2-instance' })], 'COMPLETE', 'ec2-instance'), providerKey: 'aws', synchronizedAt: at, workspaceId,
    });
    await getReconciler().reconcile({
      connectionId, discovery: discovery([resource('i-type-a', { resourceKind: 'ec2-reserved-instance' })], 'COMPLETE', 'ec2-reserved-instance'), providerKey: 'aws', synchronizedAt: at, workspaceId,
    });

    const rows = await getClient().database.select().from(cloudResources).where(
      and(eq(cloudResources.workspaceId, workspaceId), eq(cloudResources.externalResourceId, 'i-type-a')),
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.resourceType))).toEqual(new Set(['ec2-instance', 'ec2-reserved-instance']));
  });
});
