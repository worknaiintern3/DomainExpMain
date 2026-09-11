import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from './client';
import { getDomainMetadata, refreshDomainMetadata } from './metadata';

vi.mock('./client', () => ({ apiRequest: vi.fn() }));

const apiRequestMock = vi.mocked(apiRequest);
const domainId = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockResolvedValue({});
});

describe('domain metadata API adapter', () => {
  it('loads metadata with stale-request cancellation support', async () => {
    const controller = new AbortController();
    await getDomainMetadata(domainId, controller.signal);
    expect(apiRequestMock).toHaveBeenCalledWith(
      `/domains/${domainId}/metadata`,
      { signal: controller.signal },
    );
  });

  it('refreshes all sources by default or an explicit source subset', async () => {
    await refreshDomainMetadata(domainId);
    await refreshDomainMetadata(domainId, ['dns']);
    expect(apiRequestMock.mock.calls).toEqual([
      [`/domains/${domainId}/metadata/refresh`, { body: {}, method: 'POST' }],
      [`/domains/${domainId}/metadata/refresh`, { body: { sources: ['dns'] }, method: 'POST' }],
    ]);
  });
});
