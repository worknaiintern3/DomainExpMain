import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({ apiRequest }));

import { probeApplicationUrl } from './applicationProbe';

beforeEach(() => apiRequest.mockReset());

describe('application probe compatibility', () => {
  it('maps this backend\'s GET probe into the website result', async () => {
    apiRequest.mockResolvedValue({
      online: true,
      statusCode: 200,
      latencyMs: 42,
      title: 'Example',
      ssl: true,
      error: null,
    });

    const result = await probeApplicationUrl('https://example.com/');

    expect(apiRequest).toHaveBeenCalledWith('/applications/probe?url=https%3A%2F%2Fexample.com%2F', {});
    expect(result).toMatchObject({ online: true, latencyMs: 42, ssl: { enabled: true, valid: null } });
  });

  it('keeps URL secrets out of GET query parameters', async () => {
    await expect(probeApplicationUrl('https://example.com/?token=secret')).rejects.toThrow(/query parameters/);
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
