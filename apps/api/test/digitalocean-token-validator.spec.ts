import { describe, expect, it, vi } from 'vitest';

import {
  DigitalOceanTokenValidationError,
  DigitalOceanTokenValidator,
} from '../src/provider-connections/digitalocean-token-validator';

const MAX_RESPONSE_BYTES = 2_000_000;

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { headers, status });
}

function fetchReturning(response: Response): typeof fetch {
  return vi.fn().mockResolvedValue(response) as typeof fetch;
}

describe('DigitalOceanTokenValidator', () => {
  it('returns true for a token that can read the account', async () => {
    const validator = new DigitalOceanTokenValidator({
      fetchImplementation: fetchReturning(jsonResponse(200, { account: { status: 'active' } })),
    });
    await expect(validator.isTokenActive('do-token')).resolves.toBe(true);
  });

  it('returns false for a locked account, not a thrown error', async () => {
    const validator = new DigitalOceanTokenValidator({
      fetchImplementation: fetchReturning(jsonResponse(200, { account: { status: 'locked' } })),
    });
    await expect(validator.isTokenActive('do-token')).resolves.toBe(false);
  });

  it('maps HTTP 401 to a truthful "not active" result, not a thrown error', async () => {
    const validator = new DigitalOceanTokenValidator({
      fetchImplementation: fetchReturning(new Response('', { status: 401 })),
    });
    await expect(validator.isTokenActive('do-token')).resolves.toBe(false);
  });

  it('maps HTTP 403 to a distinct PERMISSION_DENIED error, never conflated with an invalid token', async () => {
    const validator = new DigitalOceanTokenValidator({
      fetchImplementation: fetchReturning(new Response('', { status: 403 })),
    });
    await expect(validator.isTokenActive('do-token')).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(validator.isTokenActive('do-token')).rejects.toBeInstanceOf(DigitalOceanTokenValidationError);
  });

  it('maps HTTP 429 to RATE_LIMITED', async () => {
    const validator = new DigitalOceanTokenValidator({
      fetchImplementation: fetchReturning(new Response('', { status: 429 })),
    });
    await expect(validator.isTokenActive('do-token')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('maps a 5xx response to UPSTREAM_UNAVAILABLE', async () => {
    const validator = new DigitalOceanTokenValidator({
      fetchImplementation: fetchReturning(new Response('', { status: 503 })),
    });
    await expect(validator.isTokenActive('do-token')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('maps an aborted request (timeout) to NETWORK_TIMEOUT', async () => {
    const validator = new DigitalOceanTokenValidator({
      fetchImplementation: vi.fn().mockImplementation((_url: unknown, init?: { signal?: AbortSignal }) => {
        const signal = init?.signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      }) as unknown as typeof fetch,
      timeoutMs: 5,
    });
    await expect(validator.isTokenActive('do-token')).rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' });
  });

  it('maps a network-level fetch failure (no abort) to UPSTREAM_UNAVAILABLE', async () => {
    const validator = new DigitalOceanTokenValidator({
      fetchImplementation: vi.fn().mockRejectedValue(new Error('getaddrinfo failure')) as unknown as typeof fetch,
    });
    await expect(validator.isTokenActive('do-token')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('maps a malformed JSON response to UPSTREAM_BAD_RESPONSE', async () => {
    const validator = new DigitalOceanTokenValidator({
      fetchImplementation: fetchReturning(new Response('not json', { status: 200 })),
    });
    await expect(validator.isTokenActive('do-token')).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('maps a 200 response that fails the account schema to UPSTREAM_BAD_RESPONSE', async () => {
    const validator = new DigitalOceanTokenValidator({
      fetchImplementation: fetchReturning(jsonResponse(200, { unexpected: true })),
    });
    await expect(validator.isTokenActive('do-token')).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('rejects a blank/whitespace token before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    const validator = new DigitalOceanTokenValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await expect(validator.isTokenActive('   ')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never follows an HTTP redirect (always requests redirect: "error")', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { account: { status: 'active' } }));
    const validator = new DigitalOceanTokenValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await validator.isTokenActive('do-token');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.redirect).toBe('error');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer do-token' });
  });

  it('rejects a body over the response size bound', async () => {
    const oversizedBody = JSON.stringify({ account: { extra: 'x'.repeat(MAX_RESPONSE_BYTES), status: 'active' } });
    const validator = new DigitalOceanTokenValidator({
      fetchImplementation: fetchReturning(new Response(oversizedBody, { status: 200 })),
    });
    await expect(validator.isTokenActive('do-token')).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });
});
