import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from './client';
import { listProviderAccounts } from './provider-connections';

vi.mock('./client', () => ({ apiRequest: vi.fn() }));

const request = vi.mocked(apiRequest);

beforeEach(() => request.mockReset());

describe('provider accounts used by integrations', () => {
  it('loads every cursor page so mobile-created accounts are not hidden after the first page', async () => {
    request
      .mockResolvedValueOnce({ items: [{ id: 'first', label: 'First', providerKey: 'cloudflare' }], nextCursor: 'page-two' })
      .mockResolvedValueOnce({ items: [{ id: 'second', label: 'Second', providerKey: 'hostinger' }], nextCursor: null });

    const result = await listProviderAccounts();

    expect(result.items.map((account) => account.id)).toEqual(['first', 'second']);
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      '/provider-accounts?limit=100',
      '/provider-accounts?limit=100&cursor=page-two',
    ]);
  });
});
