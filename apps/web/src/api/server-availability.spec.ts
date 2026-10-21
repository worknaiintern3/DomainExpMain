import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from './client';
import {
  getServerAvailability,
  listServerAvailabilityRuns,
  postServerAvailabilityRun,
  putServerAvailability,
} from './server-availability';

vi.mock('./client', () => ({ apiRequest: vi.fn() }));

const request = vi.mocked(apiRequest);
const serverId = 'server/one';
const path = '/servers/server%2Fone/availability';

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({});
});

describe('server availability API adapter', () => {
  it('loads the target with cancellation support', async () => {
    const controller = new AbortController();
    await getServerAvailability(serverId, controller.signal);
    expect(request).toHaveBeenCalledWith(path, { signal: controller.signal });
  });

  it('sends target configuration without changing unrelated server data', async () => {
    const body = { enabled: true, checkIntervalMinutes: 5, addressSource: 'PRIMARY_IP' as const, port: 443 };
    await putServerAvailability(serverId, body);
    expect(request).toHaveBeenCalledWith(path, { method: 'PUT', body });
  });

  it('encodes bounded history queries and supports cancellation', async () => {
    const controller = new AbortController();
    await listServerAvailabilityRuns(serverId, {
      cursor: 'opaque+/=', limit: 10, status: 'ERROR', trigger: 'RETRY',
    }, controller.signal);
    expect(request).toHaveBeenCalledWith(
      `${path}/runs?cursor=opaque%2B%2F%3D&limit=10&status=ERROR&trigger=RETRY`,
      { signal: controller.signal },
    );
  });

  it('queues a manual check with the idempotency header and no body', async () => {
    await postServerAvailabilityRun(serverId, 'once-only');
    expect(request).toHaveBeenCalledWith(`${path}/runs`, {
      method: 'POST', headers: { 'Idempotency-Key': 'once-only' },
    });
  });
});
