import { getInventory } from '@/api/inventory';
import type { EmailAccount } from '@/api/types';

interface EmailFlight {
  generation: number;
  promise: Promise<EmailAccount>;
}

let activeScopeKey: string | null = null;
let generation = 0;
const successes = new Map<string, EmailAccount>();
const flights = new Map<string, EmailFlight>();

export function activateEmailCacheScope(scopeKey: string | null): void {
  if (activeScopeKey === scopeKey) return;
  activeScopeKey = scopeKey;
  generation += 1;
  successes.clear();
  flights.clear();
}

export function getCachedEmailAccount(id: string): EmailAccount | undefined {
  return successes.get(id);
}

export function resolveEmailAccount(id: string): Promise<EmailAccount> {
  const cached = successes.get(id);
  if (cached) return Promise.resolve(cached);
  const existing = flights.get(id);
  if (existing?.generation === generation) return existing.promise;

  const requestGeneration = generation;
  const promise = getInventory('email-accounts', id).then((account) => {
    if (requestGeneration === generation) successes.set(id, account);
    return account;
  });
  const flight = { generation: requestGeneration, promise };
  flights.set(id, flight);
  void promise.finally(() => {
    if (flights.get(id) === flight) flights.delete(id);
  }).catch(() => undefined);
  return promise;
}
