import { describe, expect, it } from 'vitest';

import type {
  DiscoveredProviderServer,
  ProviderAdapter,
  ProviderServerDiscovery,
  ServerDiscoveryCapability,
} from '../src/providers/provider-adapter.types';
import {
  ProviderServerReconciler,
  ProviderServerSyncService,
} from '../src/providers/reconciliation/provider-server-reconciliation.service';
import { isPublicIpAddress } from '../src/providers/reconciliation/public-ip';
import type {
  ActivateProviderServerResourceLinkInput,
  ProviderServerReconciliationTransaction,
  ProviderServerReconciliationStore,
  ProviderServerResourceLinkOutcome,
  ReconciledServerRecord,
} from '../src/providers/reconciliation/provider-server-reconciliation.types';

interface MemoryServer extends ReconciledServerRecord {
  primaryIp: string | null;
}

interface MemoryLink {
  externalResourceId: string;
  externalResourceType: string;
  missingSince: Date | null;
  nodeId: string;
  providerStatus: string;
  status: 'ACTIVE' | 'MISSING_FROM_PROVIDER';
  synchronizedAt: Date;
}

class MemoryReconciliationStore implements ProviderServerReconciliationStore {
  readonly events: string[] = [];
  readonly links = new Map<string, MemoryLink>();
  readonly servers = new Map<string, MemoryServer>();
  providerAccountId = 'provider-account-1';
  providerKey = 'digitalocean';
  private nextServerId = 1;

  async withWorkspaceTransaction<T>(
    _workspaceId: string,
    _connectionId: string,
    operation: (transaction: ProviderServerReconciliationTransaction) => Promise<T>,
  ): Promise<T> {
    this.events.push('db');
    return await operation({
      activateResourceLink: async (input) => this.activate(input),
      findLinkedServerNodeId: (type, externalId) => {
        const link = this.links.get(`${type}:${externalId}`);
        return Promise.resolve(link?.nodeId);
      },
      findOrCreateServer: (discovered) => {
        // Mirror of the production Postgres rule: first-time IP attachment
        // only on a globally routable public IP with exactly one eligible
        // unlinked candidate; otherwise create a new PROVIDER_API server.
        if (discovered.primaryIp !== null && isPublicIpAddress(discovered.primaryIp)) {
          const eligible: MemoryServer[] = [];
          for (const [nodeId, server] of [...this.servers.entries()]) {
            if (server.primaryIp !== discovered.primaryIp) continue;
            const alreadyLinked = [...this.links.values()].some(
              (link) => link.nodeId === nodeId && link.status === 'ACTIVE',
            );
            if (!alreadyLinked) eligible.push(server);
            if (eligible.length > 1) break;
          }
          if (eligible.length === 1 && eligible[0]) {
            return Promise.resolve({ ...eligible[0], created: false });
          }
        }
        const nodeId = `node-${String(this.nextServerId)}`;
        const created: MemoryServer = {
          created: true,
          id: `server-${String(this.nextServerId)}`,
          primaryIp: discovered.primaryIp,
          provenance: 'PROVIDER_API',
        };
        this.nextServerId += 1;
        this.servers.set(nodeId, created);
        return Promise.resolve({ ...created });
      },
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
      resolveConnectionProviderAccountId: (providerKey) =>
        Promise.resolve(
          providerKey === this.providerKey ? this.providerAccountId : undefined,
        ),
      resolveServerNodeId: (serverId) => {
        for (const [nodeId, server] of this.servers.entries()) {
          if (server.id === serverId) return Promise.resolve(nodeId);
        }
        return Promise.resolve(undefined);
      },
    });
  }

  private activate(
    input: ActivateProviderServerResourceLinkInput,
  ): Promise<ProviderServerResourceLinkOutcome> {
    const key = `${input.externalResourceType}:${input.externalResourceId}`;
    const existing = this.links.get(key);
    if (existing && existing.synchronizedAt > input.synchronizedAt) {
      return Promise.resolve('UNCHANGED');
    }
    if (!existing) {
      this.links.set(key, {
        ...input,
        missingSince: null,
        status: 'ACTIVE',
      });
      return Promise.resolve('CREATED');
    }
    const changed =
      existing.nodeId !== input.nodeId ||
      existing.providerStatus !== input.providerStatus ||
      existing.status !== 'ACTIVE';
    Object.assign(existing, input, { missingSince: null, status: 'ACTIVE' });
    return Promise.resolve(changed ? 'UPDATED' : 'UNCHANGED');
  }
}

function discovery(
  servers: readonly DiscoveredProviderServer[],
  completion: 'COMPLETE' | 'PARTIAL' = 'COMPLETE',
): ProviderServerDiscovery {
  return {
    completion,
    error: completion === 'PARTIAL'
      ? { code: 'UPSTREAM_UNAVAILABLE', retryAfterSeconds: null }
      : null,
    externalResourceType: 'digitalocean.droplet',
    servers,
  };
}

const at = new Date('2026-09-15T00:00:00.000Z');
const server = (
  externalResourceId: string,
  primaryIp: string | null,
  canonicalName = 'web-1',
): DiscoveredProviderServer => ({
  canonicalName,
  externalResourceId,
  hostname: null,
  operatingSystem: 'ubuntu-22-04-x64',
  primaryIp,
  providerStatus: 'active',
  region: 'nyc3',
  serverKind: 's-1vcpu-1gb',
});

describe('provider server reconciliation', () => {
  it('fails closed when the connection does not belong to the adapter provider', async () => {
    const store = new MemoryReconciliationStore();
    await expect(new ProviderServerReconciler(store).reconcile({
      connectionId: 'connection-1',
      discovery: discovery([server('droplet-1', '93.184.216.34')]),
      providerKey: 'different-provider',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    })).rejects.toMatchObject({ code: 'CONNECTION_UNAVAILABLE' });
    expect(store.servers.size).toBe(0);
    expect(store.links.size).toBe(0);
  });

  it('attaches to a compatible unlinked server by primary IP instead of duplicating it, preserving provenance', async () => {
    const store = new MemoryReconciliationStore();
    store.servers.set('node-existing', {
      created: false,
      id: 'user-server',
      primaryIp: '93.184.216.34',
      provenance: 'USER_ADDED',
    });
    const reconciler = new ProviderServerReconciler(store);
    const summary = await reconciler.reconcile({
      connectionId: 'connection-1',
      discovery: discovery([server('droplet-1', '93.184.216.34')]),
      providerKey: 'digitalocean',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    });

    expect(store.servers.size).toBe(1);
    expect(store.servers.get('node-existing')).toMatchObject({ provenance: 'USER_ADDED' });
    expect(store.links.get('digitalocean.droplet:droplet-1')).toMatchObject({ nodeId: 'node-existing' });
    expect(summary).toEqual({
      itemsCreated: 1,
      itemsDiscovered: 1,
      itemsMissing: 0,
      itemsUnchanged: 0,
      itemsUpdated: 0,
    });
  });

  it('creates a new PROVIDER_API server when no compatible unlinked match exists', async () => {
    const store = new MemoryReconciliationStore();
    const reconciler = new ProviderServerReconciler(store);
    await reconciler.reconcile({
      connectionId: 'connection-1',
      discovery: discovery([server('droplet-1', '93.184.216.34')]),
      providerKey: 'digitalocean',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    });

    expect(store.servers.size).toBe(1);
    expect([...store.servers.values()][0]).toMatchObject({ primaryIp: '93.184.216.34', provenance: 'PROVIDER_API' });
  });

  it('never re-targets a server another active provider link already claims, even on an IP collision', async () => {
    const store = new MemoryReconciliationStore();
    store.servers.set('node-claimed', { created: false, id: 'claimed-server', primaryIp: '93.184.216.34', provenance: 'PROVIDER_API' });
    store.links.set('other.type:other-id', {
      externalResourceId: 'other-id',
      externalResourceType: 'other.type',
      missingSince: null,
      nodeId: 'node-claimed',
      providerStatus: 'active',
      status: 'ACTIVE',
      synchronizedAt: at,
    });
    const reconciler = new ProviderServerReconciler(store);
    await reconciler.reconcile({
      connectionId: 'connection-1',
      discovery: discovery([server('droplet-1', '93.184.216.34')]),
      providerKey: 'digitalocean',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    });

    // A new server was created rather than stealing the already-linked one.
    expect(store.servers.size).toBe(2);
    expect(store.links.get('digitalocean.droplet:droplet-1')?.nodeId).not.toBe('node-claimed');
  });

  it('is idempotent across resyncs and stays stable even if the discovered IP changes upstream', async () => {
    const store = new MemoryReconciliationStore();
    const reconciler = new ProviderServerReconciler(store);
    const base = {
      connectionId: 'connection-1',
      providerKey: 'digitalocean',
      workspaceId: 'workspace-1',
    };

    const first = await reconciler.reconcile({
      ...base,
      discovery: discovery([server('droplet-1', '93.184.216.34')]),
      synchronizedAt: at,
    });
    expect(first).toMatchObject({ itemsCreated: 1, itemsUpdated: 0 });
    const firstNodeId = store.links.get('digitalocean.droplet:droplet-1')?.nodeId;

    // Repeat sync with the same server unchanged: fully idempotent.
    const repeat = await reconciler.reconcile({
      ...base,
      discovery: discovery([server('droplet-1', '93.184.216.34')]),
      synchronizedAt: new Date(at.getTime() + 1_000),
    });
    expect(repeat).toMatchObject({ itemsCreated: 0, itemsUnchanged: 1, itemsUpdated: 0 });
    expect(store.servers.size).toBe(1);

    // Even if the provider now reports a different IP for the same
    // external id, the stable link -> node identity must not change or
    // create a duplicate server.
    const reassigned = await reconciler.reconcile({
      ...base,
      discovery: discovery([server('droplet-1', '8.8.8.8')]),
      synchronizedAt: new Date(at.getTime() + 2_000),
    });
    expect(reassigned.itemsCreated).toBe(0);
    expect(store.servers.size).toBe(1);
    expect(store.links.get('digitalocean.droplet:droplet-1')?.nodeId).toBe(firstNodeId);
  });

  it('marks absent links missing only after a complete enumeration and never hard-deletes', async () => {
    const store = new MemoryReconciliationStore();
    const reconciler = new ProviderServerReconciler(store);
    const base = {
      connectionId: 'connection-1',
      providerKey: 'digitalocean',
      workspaceId: 'workspace-1',
    };
    await reconciler.reconcile({ ...base, discovery: discovery([server('droplet-1', '93.184.216.34')]), synchronizedAt: at });

    const partial = await reconciler.reconcile({
      ...base,
      discovery: discovery([], 'PARTIAL'),
      synchronizedAt: new Date(at.getTime() + 1_000),
    });
    expect(partial.itemsMissing).toBe(0);
    expect(store.links.get('digitalocean.droplet:droplet-1')?.status).toBe('ACTIVE');
    expect(store.servers.size).toBe(1);

    const completeAt = new Date(at.getTime() + 2_000);
    const complete = await reconciler.reconcile({ ...base, discovery: discovery([]), synchronizedAt: completeAt });
    expect(complete.itemsMissing).toBe(1);
    expect(store.links.get('digitalocean.droplet:droplet-1')).toMatchObject({
      missingSince: completeAt,
      status: 'MISSING_FROM_PROVIDER',
    });
    // Reconciliation never deletes the server row itself.
    expect(store.servers.size).toBe(1);
  });

  it('reactivates a missing link on reconnect/resync and clears missing state', async () => {
    const store = new MemoryReconciliationStore();
    const reconciler = new ProviderServerReconciler(store);
    const base = { connectionId: 'connection-1', providerKey: 'digitalocean', workspaceId: 'workspace-1' };
    await reconciler.reconcile({ ...base, discovery: discovery([server('droplet-1', '93.184.216.34')]), synchronizedAt: at });
    await reconciler.reconcile({ ...base, discovery: discovery([]), synchronizedAt: new Date(at.getTime() + 1_000) });
    const result = await reconciler.reconcile({
      ...base,
      discovery: discovery([server('droplet-1', '93.184.216.34')]),
      synchronizedAt: new Date(at.getTime() + 2_000),
    });

    expect(result.itemsUpdated).toBe(1);
    expect(store.links.get('digitalocean.droplet:droplet-1')).toMatchObject({
      missingSince: null,
      status: 'ACTIVE',
    });
  });

  it('a stale synchronizedAt cannot overwrite newer link state', async () => {
    const store = new MemoryReconciliationStore();
    const reconciler = new ProviderServerReconciler(store);
    const base = { connectionId: 'connection-1', providerKey: 'digitalocean', workspaceId: 'workspace-1' };
    await reconciler.reconcile({
      ...base,
      discovery: discovery([server('droplet-1', '93.184.216.34', 'renamed')]),
      synchronizedAt: new Date(at.getTime() + 10_000),
    });
    await reconciler.reconcile({
      ...base,
      discovery: discovery([server('droplet-1', '93.184.216.34', 'stale-name')]),
      synchronizedAt: at,
    });
    expect(store.links.get('digitalocean.droplet:droplet-1')?.synchronizedAt).toEqual(
      new Date(at.getTime() + 10_000),
    );
  });

  it('does NOT guess when two eligible servers share the same public IP: creates a new PROVIDER_API server', async () => {
    const store = new MemoryReconciliationStore();
    store.servers.set('node-a', {
      created: false,
      id: 'server-a',
      primaryIp: '93.184.216.34',
      provenance: 'USER_ADDED',
    });
    store.servers.set('node-b', {
      created: false,
      id: 'server-b',
      primaryIp: '93.184.216.34',
      provenance: 'USER_ADDED',
    });
    const reconciler = new ProviderServerReconciler(store);
    await reconciler.reconcile({
      connectionId: 'connection-1',
      discovery: discovery([server('droplet-ambiguous', '93.184.216.34')]),
      providerKey: 'digitalocean',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    });

    // A third server row was created rather than attaching to either candidate.
    expect(store.servers.size).toBe(3);
    const linkNodeId = store.links.get('digitalocean.droplet:droplet-ambiguous')?.nodeId;
    expect(linkNodeId).not.toBe('node-a');
    expect(linkNodeId).not.toBe('node-b');
    const attached = linkNodeId ? store.servers.get(linkNodeId) : undefined;
    expect(attached).toMatchObject({ primaryIp: '93.184.216.34', provenance: 'PROVIDER_API' });
  });

  it.each([
    ['RFC1918 10/8', '10.0.0.5'],
    ['RFC1918 172.16/12', '172.16.5.4'],
    ['RFC1918 172.31 range', '172.31.255.1'],
    ['RFC1918 192.168/16', '192.168.1.10'],
    ['loopback', '127.0.0.1'],
    ['link-local', '169.254.10.20'],
    ['CGNAT', '100.64.0.5'],
    ['unspecified', '0.0.0.0'],
    ['multicast', '224.0.0.1'],
  ])('private IPv4 %s never auto-attaches: creates a new PROVIDER_API server', async (_label, ip) => {
    const store = new MemoryReconciliationStore();
    store.servers.set('node-existing', {
      created: false,
      id: 'user-server',
      primaryIp: ip,
      provenance: 'USER_ADDED',
    });
    const reconciler = new ProviderServerReconciler(store);
    await reconciler.reconcile({
      connectionId: 'connection-1',
      discovery: discovery([server('droplet-private', ip)]),
      providerKey: 'digitalocean',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    });

    expect(store.servers.size).toBe(2);
    const linkNodeId = store.links.get('digitalocean.droplet:droplet-private')?.nodeId;
    expect(linkNodeId).not.toBe('node-existing');
    const attached = linkNodeId ? store.servers.get(linkNodeId) : undefined;
    expect(attached).toMatchObject({ primaryIp: ip, provenance: 'PROVIDER_API' });
  });

  it.each([
    ['loopback', '::1'],
    ['unspecified', '::'],
    ['unique-local', 'fc00::1'],
    ['unique-local', 'fd00::1'],
    ['link-local', 'fe80::1'],
    ['multicast', 'ff02::1'],
    ['documentation', '2001:db8::1'],
  ])('non-public IPv6 %s never auto-attaches: creates a new PROVIDER_API server', async (_label, ip) => {
    const store = new MemoryReconciliationStore();
    store.servers.set('node-existing', {
      created: false,
      id: 'user-server',
      primaryIp: ip,
      provenance: 'USER_ADDED',
    });
    const reconciler = new ProviderServerReconciler(store);
    await reconciler.reconcile({
      connectionId: 'connection-1',
      discovery: discovery([server('droplet-private-v6', ip)]),
      providerKey: 'digitalocean',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    });

    expect(store.servers.size).toBe(2);
    expect(store.links.get('digitalocean.droplet:droplet-private-v6')?.nodeId).not.toBe('node-existing');
  });

  it('attaches on a unique public IPv6 candidate', async () => {
    const store = new MemoryReconciliationStore();
    store.servers.set('node-existing', {
      created: false,
      id: 'user-server',
      primaryIp: '2606:4700:4700::1111',
      provenance: 'USER_ADDED',
    });
    const reconciler = new ProviderServerReconciler(store);
    await reconciler.reconcile({
      connectionId: 'connection-1',
      discovery: discovery([server('droplet-v6', '2606:4700:4700::1111')]),
      providerKey: 'digitalocean',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    });

    expect(store.servers.size).toBe(1);
    expect(store.links.get('digitalocean.droplet:droplet-v6')).toMatchObject({ nodeId: 'node-existing' });
  });

  it('preserves USER_MAPPED provenance when attaching by unique public IP', async () => {
    const store = new MemoryReconciliationStore();
    store.servers.set('node-existing', {
      created: false,
      id: 'mapped-server',
      primaryIp: '93.184.216.34',
      provenance: 'USER_MAPPED',
    });
    const reconciler = new ProviderServerReconciler(store);
    await reconciler.reconcile({
      connectionId: 'connection-1',
      discovery: discovery([server('droplet-1', '93.184.216.34')]),
      providerKey: 'digitalocean',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    });

    expect(store.servers.size).toBe(1);
    expect(store.servers.get('node-existing')).toMatchObject({ provenance: 'USER_MAPPED' });
    expect(store.links.get('digitalocean.droplet:droplet-1')).toMatchObject({ nodeId: 'node-existing' });
  });

  it('a null discovered IP never matches and always creates a new PROVIDER_API server', async () => {
    const store = new MemoryReconciliationStore();
    store.servers.set('node-existing', {
      created: false,
      id: 'user-server',
      primaryIp: null,
      provenance: 'USER_ADDED',
    });
    const reconciler = new ProviderServerReconciler(store);
    await reconciler.reconcile({
      connectionId: 'connection-1',
      discovery: discovery([server('droplet-no-ip', null)]),
      providerKey: 'digitalocean',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    });

    expect(store.servers.size).toBe(2);
    expect(store.links.get('digitalocean.droplet:droplet-no-ip')?.nodeId).not.toBe('node-existing');
  });

  it('finishes provider I/O before opening the DB transaction and never returns the token', async () => {
    const store = new MemoryReconciliationStore();
    const adapter: ProviderAdapter & ServerDiscoveryCapability = {
      discoverServers: () => {
        store.events.push('network');
        return Promise.resolve(discovery([server('droplet-1', '93.184.216.34')]));
      },
      providerKey: 'digitalocean',
    };
    const service = new ProviderServerSyncService(adapter, new ProviderServerReconciler(store));
    const result = await service.synchronize({
      connectionId: 'connection-1',
      synchronizedAt: at,
      token: 'not-a-real-provider-token',
      workspaceId: 'workspace-1',
    });

    expect(store.events).toEqual(['network', 'db']);
    expect(JSON.stringify(result)).not.toContain('not-a-real-provider-token');
  });
});
