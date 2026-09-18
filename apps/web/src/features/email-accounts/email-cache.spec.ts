import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getInventory } from '@/api/inventory';
import type { EmailAccount } from '@/api/types';
import {
  activateEmailCacheScope,
  getCachedEmailAccount,
  resolveEmailAccount,
} from './email-cache';

vi.mock('@/api/inventory', () => ({ getInventory: vi.fn() }));

const getInventoryMock = vi.mocked(getInventory);
let scope = 0;

function account(id: string, email = 'qa@example.test'): EmailAccount {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    email,
    id,
    inventoryState: 'TRACKED',
    label: null,
    notes: null,
    provenance: 'USER_ADDED',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  scope += 1;
  activateEmailCacheScope(`user:session-${scope}`);
  getInventoryMock.mockReset();
});

describe('email reference cache', () => {
  it('shares and caches only successful lookups inside one identity scope', async () => {
    getInventoryMock.mockResolvedValue(account('email-1'));
    const first = resolveEmailAccount('email-1');
    const second = resolveEmailAccount('email-1');
    expect(second).toBe(first);
    await first;
    await resolveEmailAccount('email-1');
    expect(getInventoryMock).toHaveBeenCalledTimes(1);
  });

  it('clears successes on identity change and leaves failures uncached', async () => {
    getInventoryMock.mockResolvedValueOnce(account('email-1'));
    await resolveEmailAccount('email-1');
    activateEmailCacheScope(`other-user:session-${scope}`);
    expect(getCachedEmailAccount('email-1')).toBeUndefined();

    getInventoryMock
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValueOnce(account('email-1', 'new@example.test'));
    await expect(resolveEmailAccount('email-1')).rejects.toThrow('Unavailable');
    await expect(resolveEmailAccount('email-1')).resolves.toMatchObject({ email: 'new@example.test' });
  });
});
