import { describe, expect, it } from 'vitest';

import type {
  DiscoveredProviderDomain,
  DomainDiscoveryCapability,
  ProviderAdapter,
  ProviderDomainDiscovery,
} from '../src/providers/provider-adapter.types';
import {
  ProviderDomainReconciler,
  ProviderDomainSyncService,
} from '../src/providers/reconciliation/provider-domain-reconciliation.service';
import type {
  ActivateProviderResourceLinkInput,
  ProviderDomainReconciliationStore,
  ProviderDomainReconciliationTransaction,
  ProviderResourceLinkOutcome,
  ReconciledDomainRecord,
} from '../src/providers/reconciliation/provider-domain-reconciliation.types';

interface MemoryDomain extends ReconciledDomainRecord {
  dnsProviderAccountId: string | null;
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

class MemoryReconciliationStore implements ProviderDomainReconciliationStore {
  readonly domains = new Map<string, MemoryDomain>();
  readonly events: string[] = [];
  readonly links = new Map<string, MemoryLink>();
  providerAccountId = 'provider-account-1';
  providerKey = 'cloudflare';
  private nextDomainId = 1;

  async withWorkspaceTransaction<T>(
    _workspaceId: string,
    _connectionId: string,
    operation: (transaction: ProviderDomainReconciliationTransaction) => Promise<T>,
  ): Promise<T> {
    this.events.push('db');
    return await operation({
      activateResourceLink: async (input) => this.activate(input),
      associateDnsProvider: (domainId, providerAccountId) => {
        const domain = [...this.domains.values()].find(({ id }) => id === domainId);
        if (!domain || domain.dnsProviderAccountId === providerAccountId) {
          return Promise.resolve(false);
        }
        domain.dnsProviderAccountId = providerAccountId;
        return Promise.resolve(true);
      },
      findOrCreateDomain: (canonicalDomain) => {
        const existing = this.domains.get(canonicalDomain);
        if (existing) return Promise.resolve({ ...existing, created: false });
        const created: MemoryDomain = {
          created: true,
          dnsProviderAccountId: null,
          id: `domain-${String(this.nextDomainId)}`,
          provenance: 'PROVIDER_API',
        };
        this.nextDomainId += 1;
        this.domains.set(canonicalDomain, created);
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
      resolveDomainNodeId: (domainId) => Promise.resolve(`node-${domainId}`),
    });
  }

  private activate(
    input: ActivateProviderResourceLinkInput,
  ): Promise<ProviderResourceLinkOutcome> {
    const key = `${input.externalResourceType}:${input.externalResourceId}`;
    const existing = this.links.get(key);
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

function discovered(
  domains: readonly DiscoveredProviderDomain[],
  completion: 'COMPLETE' | 'PARTIAL' = 'COMPLETE',
): ProviderDomainDiscovery {
  return {
    completion,
    domains,
    error: completion === 'PARTIAL'
      ? { code: 'UPSTREAM_UNAVAILABLE', retryAfterSeconds: null }
      : null,
    externalResourceType: 'cloudflare.zone',
  };
}

const at = new Date('2026-09-15T00:00:00.000Z');
const domain = (
  externalResourceId: string,
  canonicalDomain: string,
  dnsHostedByProvider = true,
): DiscoveredProviderDomain => ({
  canonicalDomain,
  dnsHostedByProvider,
  externalResourceId,
  providerStatus: 'active',
});

describe('provider domain reconciliation', () => {
  it('fails closed when the connection does not belong to the adapter provider', async () => {
    const store = new MemoryReconciliationStore();
    await expect(new ProviderDomainReconciler(store).reconcile({
      connectionId: 'connection-1',
      discovery: discovered([domain('zone-1', 'example.com')]),
      providerKey: 'different-provider',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    })).rejects.toMatchObject({ code: 'CONNECTION_UNAVAILABLE' });
    expect(store.domains).toHaveLength(0);
    expect(store.links).toHaveLength(0);
  });

  it('preserves user provenance, creates provider domains, and deduplicates canonical names', async () => {
    const store = new MemoryReconciliationStore();
    store.domains.set('example.com', {
      created: false,
      dnsProviderAccountId: null,
      id: 'user-domain',
      provenance: 'USER_ADDED',
    });
    const reconciler = new ProviderDomainReconciler(store);
    const summary = await reconciler.reconcile({
      connectionId: 'connection-1',
      discovery: discovered([
        domain('zone-1', 'example.com'),
        domain('zone-2', 'xn--bcher-kva.example', false),
        domain('zone-3', 'xn--bcher-kva.example'),
      ]),
      providerKey: 'cloudflare',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    });

    expect(store.domains).toHaveLength(2);
    expect(store.domains.get('example.com')).toMatchObject({
      dnsProviderAccountId: 'provider-account-1',
      provenance: 'USER_ADDED',
    });
    expect(store.domains.get('xn--bcher-kva.example')).toMatchObject({
      dnsProviderAccountId: 'provider-account-1',
      provenance: 'PROVIDER_API',
    });
    expect(store.links).toHaveLength(3);
    expect(summary).toEqual({
      itemsCreated: 3,
      itemsDiscovered: 3,
      itemsMissing: 0,
      itemsUnchanged: 0,
      itemsUpdated: 0,
    });
  });

  it('marks absent links missing only after a complete enumeration', async () => {
    const store = new MemoryReconciliationStore();
    const reconciler = new ProviderDomainReconciler(store);
    const base = {
      connectionId: 'connection-1',
      providerKey: 'cloudflare',
      synchronizedAt: at,
      workspaceId: 'workspace-1',
    };
    await reconciler.reconcile({ ...base, discovery: discovered([domain('zone-1', 'example.com')]) });

    const partial = await reconciler.reconcile({
      ...base,
      discovery: discovered([], 'PARTIAL'),
      synchronizedAt: new Date(at.getTime() + 1_000),
    });
    expect(partial.itemsMissing).toBe(0);
    expect(store.links.get('cloudflare.zone:zone-1')?.status).toBe('ACTIVE');

    const completeAt = new Date(at.getTime() + 2_000);
    const complete = await reconciler.reconcile({
      ...base,
      discovery: discovered([]),
      synchronizedAt: completeAt,
    });
    expect(complete.itemsMissing).toBe(1);
    expect(store.links.get('cloudflare.zone:zone-1')).toMatchObject({
      missingSince: completeAt,
      status: 'MISSING_FROM_PROVIDER',
    });
  });

  it('reactivates a missing link and clears missing state', async () => {
    const store = new MemoryReconciliationStore();
    const reconciler = new ProviderDomainReconciler(store);
    const input = {
      connectionId: 'connection-1',
      providerKey: 'cloudflare',
      workspaceId: 'workspace-1',
    };
    await reconciler.reconcile({
      ...input,
      discovery: discovered([domain('zone-1', 'example.com')]),
      synchronizedAt: at,
    });
    await reconciler.reconcile({
      ...input,
      discovery: discovered([]),
      synchronizedAt: new Date(at.getTime() + 1_000),
    });
    const result = await reconciler.reconcile({
      ...input,
      discovery: discovered([domain('zone-1', 'example.com')]),
      synchronizedAt: new Date(at.getTime() + 2_000),
    });

    expect(result.itemsUpdated).toBe(1);
    expect(store.links.get('cloudflare.zone:zone-1')).toMatchObject({
      missingSince: null,
      status: 'ACTIVE',
    });
  });

  it('finishes provider I/O before opening the DB transaction and never returns the token', async () => {
    const store = new MemoryReconciliationStore();
    const adapter: ProviderAdapter & DomainDiscoveryCapability = {
      discoverDomains: () => {
        store.events.push('network');
        return Promise.resolve(discovered([domain('zone-1', 'example.com')]));
      },
      providerKey: 'cloudflare',
    };
    const service = new ProviderDomainSyncService(
      adapter,
      new ProviderDomainReconciler(store),
    );
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
