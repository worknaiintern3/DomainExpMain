import {
  InvalidDomainNameError,
  normalizeDomainName,
} from '@domainpulse/database';

import type {
  DomainDiscoveryCapability,
  ProviderAdapter,
  ProviderDomainDiscovery,
} from '../provider-adapter.types';
import {
  ProviderAdapterError,
  ProviderReconciliationError,
} from '../provider.errors';
import type {
  ProviderDomainReconciliationInput,
  ProviderDomainReconciliationStore,
  ProviderDomainReconciliationSummary,
  ProviderDomainSyncInput,
  ProviderDomainSyncResult,
} from './provider-domain-reconciliation.types';

const CANONICAL_RESOURCE_TYPE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;

function validatedDiscovery(
  discovery: ProviderDomainDiscovery,
): ProviderDomainDiscovery {
  if (
    !CANONICAL_RESOURCE_TYPE.test(discovery.externalResourceType) ||
    discovery.externalResourceType.length > 64 ||
    (discovery.completion === 'COMPLETE' && discovery.error !== null) ||
    (discovery.completion === 'PARTIAL' && discovery.error === null)
  ) {
    throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
  }

  const domains = new Map<string, (typeof discovery.domains)[number]>();
  for (const domain of discovery.domains) {
    let normalized;
    try {
      normalized = normalizeDomainName(domain.canonicalDomain);
    } catch (error) {
      if (error instanceof InvalidDomainNameError) {
        throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
      }
      throw error;
    }
    if (
      normalized.normalizedDomainName !== domain.canonicalDomain ||
      domain.externalResourceId.trim().length === 0 ||
      domain.externalResourceId.trim() !== domain.externalResourceId ||
      domain.externalResourceId.length > 1_024 ||
      !CANONICAL_RESOURCE_TYPE.test(domain.providerStatus) ||
      domain.providerStatus.length > 64
    ) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    const prior = domains.get(domain.externalResourceId);
    if (
      prior &&
      (prior.canonicalDomain !== domain.canonicalDomain ||
        prior.dnsHostedByProvider !== domain.dnsHostedByProvider ||
        prior.providerStatus !== domain.providerStatus)
    ) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    domains.set(domain.externalResourceId, domain);
  }

  return { ...discovery, domains: [...domains.values()] };
}

export class ProviderDomainReconciler {
  constructor(private readonly store: ProviderDomainReconciliationStore) {}

  async reconcile(
    input: ProviderDomainReconciliationInput,
  ): Promise<ProviderDomainReconciliationSummary> {
    if (Number.isNaN(input.synchronizedAt.getTime())) {
      throw new ProviderAdapterError('INVALID_REQUEST');
    }
    const discovery = validatedDiscovery(input.discovery);

    return await this.store.withWorkspaceTransaction(
      input.workspaceId,
      input.connectionId,
      async (transaction) => {
        const providerAccountId =
          await transaction.resolveConnectionProviderAccountId(
            input.providerKey,
          );
        if (!providerAccountId) {
          throw new ProviderReconciliationError('CONNECTION_UNAVAILABLE');
        }

        let itemsCreated = 0;
        let itemsUpdated = 0;
        let itemsUnchanged = 0;
        const seenExternalResourceIds = new Set<string>();

        for (const discovered of discovery.domains) {
          seenExternalResourceIds.add(discovered.externalResourceId);
          const domain = await transaction.findOrCreateDomain(
            discovered.canonicalDomain,
            input.synchronizedAt,
          );
          const dnsAssociationChanged =
            discovered.dnsHostedByProvider &&
            domain.dnsProviderAccountId !== providerAccountId
            ? await transaction.associateDnsProvider(
                domain.id,
                providerAccountId,
                input.synchronizedAt,
              )
            : false;
          const nodeId = await transaction.resolveDomainNodeId(domain.id);
          if (!nodeId) {
            throw new ProviderReconciliationError('INTERNAL_INTEGRITY_ERROR');
          }
          const outcome = await transaction.activateResourceLink({
            externalResourceId: discovered.externalResourceId,
            externalResourceType: discovery.externalResourceType,
            nodeId,
            providerStatus: discovered.providerStatus,
            synchronizedAt: input.synchronizedAt,
          });

          if (outcome === 'CREATED') itemsCreated += 1;
          else if (outcome === 'UPDATED' || dnsAssociationChanged) {
            itemsUpdated += 1;
          } else itemsUnchanged += 1;
        }

        const itemsMissing = discovery.completion === 'COMPLETE'
          ? await transaction.markMissingResources(
              discovery.externalResourceType,
              seenExternalResourceIds,
              input.synchronizedAt,
            )
          : 0;

        return {
          itemsCreated,
          itemsDiscovered: discovery.domains.length,
          itemsMissing,
          itemsUnchanged,
          itemsUpdated,
        };
      },
    );
  }
}

export class ProviderDomainSyncService {
  constructor(
    private readonly adapter: ProviderAdapter & DomainDiscoveryCapability,
    private readonly reconciler: ProviderDomainReconciler,
  ) {}

  async synchronize(input: ProviderDomainSyncInput): Promise<ProviderDomainSyncResult> {
    // The complete provider enumeration finishes before the short DB transaction
    // starts. The plaintext token is never passed to the persistence boundary.
    const discovery = await this.adapter.discoverDomains(input.token);
    const summary = await this.reconciler.reconcile({
      connectionId: input.connectionId,
      discovery,
      providerKey: this.adapter.providerKey,
      synchronizedAt: input.synchronizedAt,
      workspaceId: input.workspaceId,
    });
    return {
      ...summary,
      completion: discovery.completion,
      error: discovery.error,
    };
  }
}
