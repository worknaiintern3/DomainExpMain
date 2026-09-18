import { getInventory } from '@/api/inventory';
import type { ProviderAccount } from '@/api/types';

interface ProviderFlight {
  generation: number;
  promise: Promise<ProviderAccount>;
}

let activeScopeKey: string | null = null;
let generation = 0;
const successes = new Map<string, ProviderAccount>();
const flights = new Map<string, ProviderFlight>();

export function activateProviderCacheScope(scopeKey: string | null): void {
  if (activeScopeKey === scopeKey) return;
  activeScopeKey = scopeKey;
  generation += 1;
  successes.clear();
  flights.clear();
}

export function getCachedProviderAccount(id: string): ProviderAccount | undefined {
  return successes.get(id);
}

export function resolveProviderAccount(id: string): Promise<ProviderAccount> {
  const cached = successes.get(id);
  if (cached) return Promise.resolve(cached);
  const existing = flights.get(id);
  if (existing && existing.generation === generation) return existing.promise;

  const requestGeneration = generation;
  const promise = getInventory('provider-accounts', id).then((provider) => {
    if (requestGeneration === generation) successes.set(id, provider);
    return provider;
  });
  const flight = { generation: requestGeneration, promise };
  flights.set(id, flight);
  void promise.finally(() => {
    if (flights.get(id) === flight) flights.delete(id);
  }).catch(() => undefined);
  return promise;
}
