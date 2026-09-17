import { describe, expect, it } from 'vitest';

import type {
  CloudResourceDiscoveryCapability,
  DiscoveredCloudResource,
  ProviderCloudResourceDiscovery,
} from '../src/providers/cloud-resource-adapter.types';
import type { ProviderAdapter } from '../src/providers/provider-adapter.types';
import {
  ProviderCloudResourceReconciler,
  ProviderCloudResourceSyncService,
} from '../src/providers/reconciliation/provider-cloud-resource-reconciliation.service';
import type {
  ActivateCloudResourceLinkInput,
  ProviderCloudResourceReconciliationStore,
  ProviderCloudResourceReconciliationTransaction,
  ReconciledCloudResourceRecord,
  UpsertCloudResourceInput,
} from '../src/providers/reconciliation/provider-cloud-resource-reconciliation.types';
import type { ProviderResourceLinkOutcome } from '../src/providers/reconciliation/provider-domain-reconciliation.types';

interface MemoryResource extends ReconciledCloudResourceRecord {
  name: string;
  region: string | null;
}

interface MemoryLink {
  externalMetadata: Record<string, unknown>;
  externalResourceId: string;
  externalResourceType: string;
  missingSince: Date | null;
  nodeId: string;
  status: 'ACTIVE' | 'MISSING_FROM_PROVIDER';
  synchronizedAt: Date;
}

class MemoryCloudResourceStore implements ProviderCloudResourceReconciliationStore {
  readonly events: string[] = [];
  readonly links = new Map<string, MemoryLink>();
  readonly resources = new Map<string, MemoryResource>();
  providerAccountId = 'provider-account-1';
  providerKey = 'aws';
  private nextResourceId = 1;

  async withWorkspaceTransaction<T>(
    _workspaceId: string,
    _connectionId: string,
    operation: (transaction: ProviderCloudResourceReconciliationTransaction) => Promise<T>,
  ): Promise<T> {
    this.events.push('db');
    return await operation({
      activateResourceLink: async (input) => this.activate(input),
      markMissingResources: (type, seen, at) => {
        let count = 0;
        for (const link of this.links.values()) {
          if (link.externalResourceType !== type || seen.has(link.externalResourceId)) continue;
          if (link.status === 'ACTIVE') {
            link.status = 'MISSING_FROM_PROVIDER';
            link.missingSince = at;
            count += 1;
          }
          link.synchronizedAt = at;
        }
        return Promise.resolve(count);
      },
      resolveCloudResourceNodeId: (resourceId) => Promise.resolve(`node-${resourceId}`),
      resolveConnectionProviderAccountId: (providerKey) =>
        Promise.resolve(providerKey === this.providerKey ? this.providerAccountId : undefined),
      upsertCloudResource: (input) => this.upsert(input),
    });
  }

  private upsert(input: UpsertCloudResourceInput): Promise<ReconciledCloudResourceRecord> {
    const key = `${input.resourceType}:${input.externalResourceId}`;
    const existing = this.resources.get(key);
    if (existing) {
      existing.name = input.name;
      existing.region = input.region;
      return Promise.resolve({ created: false, id: existing.id });
    }
    const created: MemoryResource = { created: true, id: `resource-${String(this.nextResourceId)}`, name: input.name, region: input.region };
    this.nextResourceId += 1;
    this.resources.set(key, created);
    return Promise.resolve({ created: true, id: created.id });
  }

  private activate(input: ActivateCloudResourceLinkInput): Promise<ProviderResourceLinkOutcome> {
    const key = `${input.externalResourceType}:${input.externalResourceId}`;
    const existing = this.links.get(key);
    if (!existing) {
      this.links.set(key, {
        externalMetadata: input.externalMetadata,
        externalResourceId: input.externalResourceId,
        externalResourceType: input.externalResourceType,
        missingSince: null,
        nodeId: input.nodeId,
        status: 'ACTIVE',
        synchronizedAt: input.synchronizedAt,
      });
      return Promise.resolve('CREATED');
    }
    const changed =
      existing.nodeId !== input.nodeId ||
      existing.status !== 'ACTIVE' ||
      JSON.stringify(existing.externalMetadata) !== JSON.stringify(input.externalMetadata);
    existing.externalMetadata = input.externalMetadata;
    existing.nodeId = input.nodeId;
    existing.missingSince = null;
    existing.status = 'ACTIVE';
    existing.synchronizedAt = input.synchronizedAt;
    return Promise.resolve(changed ? 'UPDATED' : 'UNCHANGED');
  }
}

function discovery(
  resources: readonly DiscoveredCloudResource[],
  completion: 'COMPLETE' | 'PARTIAL' = 'COMPLETE',
): ProviderCloudResourceDiscovery {
  return {
    completion,
    error: completion === 'PARTIAL' ? { code: 'UPSTREAM_UNAVAILABLE', retryAfterSeconds: null } : null,
    externalResourceType: 'ec2-instance',
    resources,
  };
}

const at = new Date('2026-09-15T00:00:00.000Z');
function resource(id: string, overrides: Partial<DiscoveredCloudResource> = {}): DiscoveredCloudResource {
  return {
    externalResourceId: id,
    imageReference: 'ami-123',
    instanceType: 't3.micro',
    launchedAt: at.toISOString(),
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

describe('provider cloud resource reconciliation', () => {
  it('fails closed when the connection does not belong to the adapter provider', async () => {
    const store = new MemoryCloudResourceStore();
    await expect(new ProviderCloudResourceReconciler(store).reconcile({
      connectionId: 'connection-1',
      discovery: discovery([resource('i-1')]),
      providerKey: 'different-provider',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    })).rejects.toMatchObject({ code: 'CONNECTION_UNAVAILABLE' });
    expect(store.resources).toHaveLength(0);
    expect(store.links).toHaveLength(0);
  });

  it('fails closed when a resource\'s resourceKind disagrees with the discovery batch\'s externalResourceType', async () => {
    const store = new MemoryCloudResourceStore();
    await expect(new ProviderCloudResourceReconciler(store).reconcile({
      connectionId: 'connection-1',
      discovery: discovery([resource('i-1', { resourceKind: 'gcp-compute-instance' })]), // discovery() sets externalResourceType: 'ec2-instance'
      providerKey: 'aws',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    })).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
    expect(store.resources).toHaveLength(0);
    expect(store.links).toHaveLength(0);
  });

  it('creates cloud resources and resource links, and deduplicates a repeated external ID within one discovery batch', async () => {
    const store = new MemoryCloudResourceStore();
    const reconciler = new ProviderCloudResourceReconciler(store);
    const summary = await reconciler.reconcile({
      connectionId: 'connection-1',
      discovery: discovery([resource('i-1'), resource('i-2'), resource('i-1')]),
      providerKey: 'aws',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    });

    expect(store.resources).toHaveLength(2);
    expect(store.links).toHaveLength(2);
    expect(summary).toEqual({
      itemsCreated: 2,
      itemsDiscovered: 2,
      itemsMissing: 0,
      itemsUnchanged: 0,
      itemsUpdated: 0,
    });
  });

  it('rejects a discovery batch with an internally inconsistent duplicate (same ID, different data)', async () => {
    const store = new MemoryCloudResourceStore();
    await expect(new ProviderCloudResourceReconciler(store).reconcile({
      connectionId: 'connection-1',
      discovery: discovery([resource('i-1', { name: 'a' }), resource('i-1', { name: 'b' })]),
      providerKey: 'aws',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    })).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('repeated sync with identical discovery is idempotent (no duplicates, itemsUnchanged not itemsUpdated/Created)', async () => {
    const store = new MemoryCloudResourceStore();
    const reconciler = new ProviderCloudResourceReconciler(store);
    const base = { connectionId: 'connection-1', providerKey: 'aws', workspaceId: 'workspace-1' };
    await reconciler.reconcile({ ...base, discovery: discovery([resource('i-1')]), synchronizedAt: at });

    const second = await reconciler.reconcile({
      ...base,
      discovery: discovery([resource('i-1')]),
      synchronizedAt: new Date(at.getTime() + 1_000),
    });

    expect(store.resources).toHaveLength(1);
    expect(store.links).toHaveLength(1);
    expect(second).toEqual({
      itemsCreated: 0,
      itemsDiscovered: 1,
      itemsMissing: 0,
      itemsUnchanged: 1,
      itemsUpdated: 0,
    });
  });

  it('marks a resource link missing only after a complete enumeration, never on a partial one', async () => {
    const store = new MemoryCloudResourceStore();
    const reconciler = new ProviderCloudResourceReconciler(store);
    const base = { connectionId: 'connection-1', providerKey: 'aws', workspaceId: 'workspace-1' };
    await reconciler.reconcile({ ...base, discovery: discovery([resource('i-1')]), synchronizedAt: at });

    const partial = await reconciler.reconcile({
      ...base,
      discovery: discovery([], 'PARTIAL'),
      synchronizedAt: new Date(at.getTime() + 1_000),
    });
    expect(partial.itemsMissing).toBe(0);
    expect(store.links.get('ec2-instance:i-1')?.status).toBe('ACTIVE');

    const completeAt = new Date(at.getTime() + 2_000);
    const complete = await reconciler.reconcile({ ...base, discovery: discovery([]), synchronizedAt: completeAt });
    expect(complete.itemsMissing).toBe(1);
    expect(store.links.get('ec2-instance:i-1')).toMatchObject({ missingSince: completeAt, status: 'MISSING_FROM_PROVIDER' });
  });

  it('reactivates a missing resource link on rediscovery', async () => {
    const store = new MemoryCloudResourceStore();
    const reconciler = new ProviderCloudResourceReconciler(store);
    const base = { connectionId: 'connection-1', providerKey: 'aws', workspaceId: 'workspace-1' };
    await reconciler.reconcile({ ...base, discovery: discovery([resource('i-1')]), synchronizedAt: at });
    await reconciler.reconcile({ ...base, discovery: discovery([]), synchronizedAt: new Date(at.getTime() + 1_000) });
    const result = await reconciler.reconcile({
      ...base,
      discovery: discovery([resource('i-1')]),
      synchronizedAt: new Date(at.getTime() + 2_000),
    });

    expect(result.itemsUpdated).toBe(1);
    expect(store.links.get('ec2-instance:i-1')).toMatchObject({ missingSince: null, status: 'ACTIVE' });
  });

  it('finishes provider I/O before opening the DB transaction and never returns the token', async () => {
    const store = new MemoryCloudResourceStore();
    const adapter: ProviderAdapter & CloudResourceDiscoveryCapability = {
      discoverCloudResources: () => {
        store.events.push('network');
        return Promise.resolve(discovery([resource('i-1')]));
      },
      providerKey: 'aws',
    };
    const service = new ProviderCloudResourceSyncService(adapter, new ProviderCloudResourceReconciler(store));
    const result = await service.synchronize({
      connectionId: 'connection-1',
      synchronizedAt: at,
      token: 'not-a-real-aws-secret',
      workspaceId: 'workspace-1',
    });

    expect(store.events).toEqual(['network', 'db']);
    expect(JSON.stringify(result)).not.toContain('not-a-real-aws-secret');
  });
});
