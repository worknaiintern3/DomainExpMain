import { describe, expect, it, vi } from 'vitest';

import {
  CloudflareTokenValidationError,
  CloudflareTokenValidator,
} from '../src/provider-connections/cloudflare-token-validator';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { headers, status });
}

function fetchReturning(response: Response): typeof fetch {
  return vi.fn().mockResolvedValue(response) as typeof fetch;
}

// Mirrors CloudflareTokenValidator's private MAX_RESPONSE_BYTES bound.
const MAX_RESPONSE_BYTES = 1_000_000;

describe('CloudflareTokenValidator', () => {
  it('returns true for an active token', async () => {
    const validator = new CloudflareTokenValidator({
      fetchImplementation: fetchReturning(
        jsonResponse(200, { result: { id: 'tok', status: 'active' }, success: true }),
      ),
    });
    await expect(validator.isTokenActive('cf-token')).resolves.toBe(true);
  });

  it('returns false (not throws) for a disabled/expired token reported as success with a non-active status', async () => {
    const validator = new CloudflareTokenValidator({
      fetchImplementation: fetchReturning(
        jsonResponse(200, { result: { id: 'tok', status: 'disabled' }, success: true }),
      ),
    });
    await expect(validator.isTokenActive('cf-token')).resolves.toBe(false);
  });

  it('maps HTTP 401 to a truthful "not active" result, not a thrown error', async () => {
    const validator = new CloudflareTokenValidator({
      fetchImplementation: fetchReturning(jsonResponse(401, { success: false })),
    });
    await expect(validator.isTokenActive('cf-token')).resolves.toBe(false);
  });

  it('maps HTTP 403 to a distinct PERMISSION_DENIED error, never conflated with an invalid token', async () => {
    const validator = new CloudflareTokenValidator({
      fetchImplementation: fetchReturning(jsonResponse(403, { success: false })),
    });
    await expect(validator.isTokenActive('cf-token')).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    await expect(validator.isTokenActive('cf-token')).rejects.toBeInstanceOf(CloudflareTokenValidationError);
  });

  it('maps HTTP 429 to RATE_LIMITED', async () => {
    const validator = new CloudflareTokenValidator({
      fetchImplementation: fetchReturning(jsonResponse(429, { success: false })),
    });
    await expect(validator.isTokenActive('cf-token')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('maps a 5xx response to UPSTREAM_UNAVAILABLE', async () => {
    const validator = new CloudflareTokenValidator({
      fetchImplementation: fetchReturning(jsonResponse(503, { success: false })),
    });
    await expect(validator.isTokenActive('cf-token')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('maps an aborted request (timeout) to NETWORK_TIMEOUT', async () => {
    const validator = new CloudflareTokenValidator({
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
    await expect(validator.isTokenActive('cf-token')).rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' });
  });

  it('maps a network-level fetch failure (no abort) to UPSTREAM_UNAVAILABLE', async () => {
    const validator = new CloudflareTokenValidator({
      fetchImplementation: vi.fn().mockRejectedValue(new Error('getaddrinfo failure')) as unknown as typeof fetch,
    });
    await expect(validator.isTokenActive('cf-token')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('maps a malformed JSON response to UPSTREAM_BAD_RESPONSE', async () => {
    const validator = new CloudflareTokenValidator({
      fetchImplementation: fetchReturning(new Response('not json', { status: 200 })),
    });
    await expect(validator.isTokenActive('cf-token')).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('treats a 200 response that fails the envelope schema as a safe "not active" result', async () => {
    const validator = new CloudflareTokenValidator({
      fetchImplementation: fetchReturning(jsonResponse(200, { unexpected: true })),
    });
    await expect(validator.isTokenActive('cf-token')).resolves.toBe(false);
  });

  it('rejects a blank/whitespace token before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    const validator = new CloudflareTokenValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await expect(validator.isTokenActive('   ')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never follows an HTTP redirect (always requests redirect: "error")', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { result: { id: 'tok', status: 'active' }, success: true }));
    const validator = new CloudflareTokenValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await validator.isTokenActive('cf-token');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.redirect).toBe('error');
  });

  it('rejects a body over the response size bound', async () => {
    const oversizedBody = JSON.stringify({
      result: { id: 'x'.repeat(MAX_RESPONSE_BYTES), status: 'active' },
      success: true,
    });
    const validator = new CloudflareTokenValidator({
      fetchImplementation: fetchReturning(new Response(oversizedBody, { status: 200 })),
    });
    await expect(validator.isTokenActive('cf-token')).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });
});
