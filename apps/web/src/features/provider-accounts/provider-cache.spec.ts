import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getInventory } from '@/api/inventory';
import type { ProviderAccount } from '@/api/types';
import {
  activateProviderCacheScope,
  getCachedProviderAccount,
  resolveProviderAccount,
} from './provider-cache';

vi.mock('@/api/inventory', () => ({ getInventory: vi.fn() }));

const getInventoryMock = vi.mocked(getInventory);
let scopeNumber = 0;

function provider(id: string, label = 'Provider'): ProviderAccount {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    externalAccountId: null,
    id,
    inventoryState: 'TRACKED',
    label,
    loginEmailAccountId: null,
    notes: null,
    provenance: 'USER_ADDED',
    providerKey: 'provider-key',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  reject(reason?: unknown): void;
  resolve(value: T): void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

beforeEach(() => {
  scopeNumber += 1;
  activateProviderCacheScope(`user:session-${scopeNumber}`);
  getInventoryMock.mockReset();
});

describe('provider account cache isolation', () => {
  it('caches successes and treats same-scope activation as a no-op', async () => {
    getInventoryMock.mockResolvedValue(provider('provider-1'));
    const first = await resolveProviderAccount('provider-1');
    activateProviderCacheScope(`user:session-${scopeNumber}`);
    const second = await resolveProviderAccount('provider-1');

    expect(second).toBe(first);
    expect(getInventoryMock).toHaveBeenCalledTimes(1);
  });

  it('clears prior successes when the identity scope changes', async () => {
    getInventoryMock
      .mockResolvedValueOnce(provider('provider-1', 'Old scope'))
      .mockResolvedValueOnce(provider('provider-1', 'New scope'));
    await resolveProviderAccount('provider-1');
    activateProviderCacheScope(`other-user:session-${scopeNumber}`);

    await expect(resolveProviderAccount('provider-1')).resolves.toMatchObject({ label: 'New scope' });
    expect(getInventoryMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache failed lookups', async () => {
    getInventoryMock
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValueOnce(provider('provider-1'));

    await expect(resolveProviderAccount('provider-1')).rejects.toThrow('Unavailable');
    await expect(resolveProviderAccount('provider-1')).resolves.toMatchObject({ id: 'provider-1' });
    expect(getInventoryMock).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight lookup without consumer cancellation', async () => {
    const lookup = deferred<ProviderAccount>();
    getInventoryMock.mockReturnValue(lookup.promise);

    const first = resolveProviderAccount('provider-1');
    const second = resolveProviderAccount('provider-1');
    expect(second).toBe(first);
    expect(getInventoryMock).toHaveBeenCalledTimes(1);
    lookup.resolve(provider('provider-1'));
    await expect(first).resolves.toMatchObject({ id: 'provider-1' });
  });

  it('prevents stale generations from repopulating a new scope', async () => {
    const oldLookup = deferred<ProviderAccount>();
    getInventoryMock.mockReturnValue(oldLookup.promise);
    const oldRequest = resolveProviderAccount('provider-1');
    activateProviderCacheScope(`new-user:session-${scopeNumber}`);
    oldLookup.resolve(provider('provider-1', 'Old scope'));
    await oldRequest;

    expect(getCachedProviderAccount('provider-1')).toBeUndefined();
  });

  it('does not let old cleanup delete a newer in-flight lookup', async () => {
    const oldLookup = deferred<ProviderAccount>();
    const newLookup = deferred<ProviderAccount>();
    getInventoryMock
      .mockReturnValueOnce(oldLookup.promise)
      .mockReturnValueOnce(newLookup.promise);
    const oldRequest = resolveProviderAccount('provider-1');
    activateProviderCacheScope(`new-user:session-${scopeNumber}`);
    const newRequest = resolveProviderAccount('provider-1');
    oldLookup.resolve(provider('provider-1', 'Old scope'));
    await oldRequest;

    expect(resolveProviderAccount('provider-1')).toBe(newRequest);
    expect(getInventoryMock).toHaveBeenCalledTimes(2);
    newLookup.resolve(provider('provider-1', 'New scope'));
    await expect(newRequest).resolves.toMatchObject({ label: 'New scope' });
  });
});
