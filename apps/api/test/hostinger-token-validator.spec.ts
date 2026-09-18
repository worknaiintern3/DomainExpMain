import { describe, expect, it, vi } from 'vitest';

import {
  HostingerTokenValidationError,
  HostingerTokenValidator,
} from '../src/provider-connections/hostinger-token-validator';

const MAX_RESPONSE_BYTES = 4_000_000;

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { headers, status });
}

function fetchReturning(response: Response): typeof fetch {
  return vi.fn().mockResolvedValue(response) as typeof fetch;
}

describe('HostingerTokenValidator', () => {
  it('returns true for a token that can read the portfolio', async () => {
    const validator = new HostingerTokenValidator({
      fetchImplementation: fetchReturning(jsonResponse(200, [{ domain: 'example.com' }])),
    });
    await expect(validator.isTokenActive('hostinger-token')).resolves.toBe(true);
  });

  it('returns true for an empty portfolio without treating it as inactive', async () => {
    const validator = new HostingerTokenValidator({
      fetchImplementation: fetchReturning(jsonResponse(200, [])),
    });
    await expect(validator.isTokenActive('hostinger-token')).resolves.toBe(true);
  });

  it('maps HTTP 401 to a truthful "not active" result, not a thrown error', async () => {
    const validator = new HostingerTokenValidator({
      fetchImplementation: fetchReturning(new Response('', { status: 401 })),
    });
    await expect(validator.isTokenActive('hostinger-token')).resolves.toBe(false);
  });

  it('maps HTTP 403 to a distinct PERMISSION_DENIED error, never conflated with an invalid token', async () => {
    const validator = new HostingerTokenValidator({
      fetchImplementation: fetchReturning(new Response('', { status: 403 })),
    });
    await expect(validator.isTokenActive('hostinger-token')).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(validator.isTokenActive('hostinger-token')).rejects.toBeInstanceOf(HostingerTokenValidationError);
  });

  it('maps HTTP 429 to RATE_LIMITED', async () => {
    const validator = new HostingerTokenValidator({
      fetchImplementation: fetchReturning(new Response('', { status: 429 })),
    });
    await expect(validator.isTokenActive('hostinger-token')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('maps a 5xx response to UPSTREAM_UNAVAILABLE', async () => {
    const validator = new HostingerTokenValidator({
      fetchImplementation: fetchReturning(new Response('', { status: 503 })),
    });
    await expect(validator.isTokenActive('hostinger-token')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('maps an aborted request (timeout) to NETWORK_TIMEOUT', async () => {
    const validator = new HostingerTokenValidator({
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
    await expect(validator.isTokenActive('hostinger-token')).rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' });
  });

  it('maps a network-level fetch failure (no abort) to UPSTREAM_UNAVAILABLE', async () => {
    const validator = new HostingerTokenValidator({
      fetchImplementation: vi.fn().mockRejectedValue(new Error('getaddrinfo failure')) as unknown as typeof fetch,
    });
    await expect(validator.isTokenActive('hostinger-token')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('maps a malformed JSON response to UPSTREAM_BAD_RESPONSE', async () => {
    const validator = new HostingerTokenValidator({
      fetchImplementation: fetchReturning(new Response('not json', { status: 200 })),
    });
    await expect(validator.isTokenActive('hostinger-token')).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('maps a 200 response that fails the array schema to UPSTREAM_BAD_RESPONSE', async () => {
    const validator = new HostingerTokenValidator({
      fetchImplementation: fetchReturning(jsonResponse(200, { unexpected: true })),
    });
    await expect(validator.isTokenActive('hostinger-token')).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('rejects a blank/whitespace token before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    const validator = new HostingerTokenValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await expect(validator.isTokenActive('   ')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never follows an HTTP redirect and sends a Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, []));
    const validator = new HostingerTokenValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await validator.isTokenActive('hostinger-token');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.redirect).toBe('error');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer hostinger-token' });
  });

  it('rejects a body over the response size bound', async () => {
    const oversizedBody = JSON.stringify([{ domain: 'x'.repeat(MAX_RESPONSE_BYTES) }]);
    const validator = new HostingerTokenValidator({
      fetchImplementation: fetchReturning(new Response(oversizedBody, { status: 200 })),
    });
    await expect(validator.isTokenActive('hostinger-token')).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });
});
