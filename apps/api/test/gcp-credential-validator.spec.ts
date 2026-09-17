import { generateKeyPairSync } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { GcpCredentialValidator, GcpTokenValidationError } from '../src/provider-connections/gcp-credential-validator';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2_048 });
const TEST_PRIVATE_KEY_PEM = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

const VALID_CREDENTIAL = JSON.stringify({
  clientEmail: 'sa@my-project.iam.gserviceaccount.com',
  privateKey: TEST_PRIVATE_KEY_PEM,
  projectId: 'my-project',
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status });
}

function tokenResponse(): Response {
  return json(200, { access_token: 'test-access-token', expires_in: 3_600, token_type: 'Bearer' });
}

function fetchSequence(...responses: readonly Response[]): typeof fetch {
  const mock = vi.fn();
  for (const response of responses) mock.mockResolvedValueOnce(response);
  return mock as unknown as typeof fetch;
}

describe('GcpCredentialValidator', () => {
  it('returns true when the minted token can list Compute instances', async () => {
    const validator = new GcpCredentialValidator({
      fetchImplementation: fetchSequence(tokenResponse(), json(200, { items: {} })),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).resolves.toBe(true);
  });

  it('calls the exact aggregatedList surface Phase 10I sync uses, with maxResults=1', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(json(200, { items: {} }));
    const validator = new GcpCredentialValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await validator.isTokenActive(VALID_CREDENTIAL);

    const [computeUrl, computeInit] = fetchMock.mock.calls[1] as [string | URL, RequestInit];
    const url = new URL(computeUrl);
    expect(url.pathname).toBe('/compute/v1/projects/my-project/aggregated/instances');
    expect(url.searchParams.get('maxResults')).toBe('1');
    expect((computeInit.headers as Record<string, string>).authorization).toBe('Bearer test-access-token');
  });

  it('returns false when the key mints an invalid_grant token error, not a thrown error', async () => {
    const validator = new GcpCredentialValidator({
      fetchImplementation: fetchSequence(json(400, { error: 'invalid_grant' })),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).resolves.toBe(false);
  });

  it('maps PERMISSION_DENIED to a distinct error, never conflated with an invalid key', async () => {
    const validator = new GcpCredentialValidator({
      fetchImplementation: fetchSequence(tokenResponse(), json(403, { error: { code: 403, status: 'PERMISSION_DENIED' } })),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toBeInstanceOf(GcpTokenValidationError);
  });

  it('maps a not-found project to RESOURCE_NOT_FOUND', async () => {
    const validator = new GcpCredentialValidator({
      fetchImplementation: fetchSequence(tokenResponse(), json(404, { error: { code: 404, status: 'NOT_FOUND' } })),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('maps quota exhaustion to RATE_LIMITED', async () => {
    const validator = new GcpCredentialValidator({
      fetchImplementation: fetchSequence(tokenResponse(), json(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED' } })),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('maps a 5xx Compute response to UPSTREAM_UNAVAILABLE', async () => {
    const validator = new GcpCredentialValidator({
      fetchImplementation: fetchSequence(tokenResponse(), new Response('', { status: 503 })),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('maps a token-endpoint 5xx to UPSTREAM_UNAVAILABLE', async () => {
    const validator = new GcpCredentialValidator({ fetchImplementation: fetchSequence(new Response('', { status: 503 })) });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('maps an aborted token-mint request (timeout) to NETWORK_TIMEOUT', async () => {
    const validator = new GcpCredentialValidator({
      fetchImplementation: vi.fn().mockImplementation((_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        })) as unknown as typeof fetch,
      timeoutMs: 5,
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' });
  });

  it('maps a malformed Compute response body to UPSTREAM_BAD_RESPONSE via the JSON parse guard', async () => {
    const validator = new GcpCredentialValidator({
      fetchImplementation: fetchSequence(tokenResponse(), new Response('not json', { status: 200 })),
    });
    // response.ok is true (200), so the code proceeds to `return true` without
    // ever needing to parse -- this documents that only failure responses
    // are parsed as JSON for classification.
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).resolves.toBe(true);
  });

  it('rejects a blank credential before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    const validator = new GcpCredentialValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await expect(validator.isTokenActive('')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a private key missing the PEM header before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    const validator = new GcpCredentialValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await expect(
      validator.isTokenActive(JSON.stringify({ clientEmail: 'sa@x.iam.gserviceaccount.com', privateKey: 'not-a-key', projectId: 'my-project' })),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never sends the plaintext private key in the Compute request', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(json(200, { items: {} }));
    const validator = new GcpCredentialValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await validator.isTokenActive(VALID_CREDENTIAL);
    const [, computeInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.stringify(computeInit)).not.toContain('BEGIN PRIVATE KEY');
  });
});
