import { createVerify, generateKeyPairSync } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { GcpAdapter } from '../src/providers/gcp/gcp.adapter';
import { parseGcpCredential } from '../src/providers/gcp/gcp.constants';

const { privateKey, publicKey: _publicKey } = generateKeyPairSync('rsa', { modulusLength: 2_048 });
const TEST_PRIVATE_KEY_PEM = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

const VALID_CREDENTIAL = JSON.stringify({
  clientEmail: 'sa@my-project.iam.gserviceaccount.com',
  privateKey: TEST_PRIVATE_KEY_PEM,
  projectId: 'my-project',
});

function json(value: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(value), { ...init, headers });
}

function tokenResponse(): Response {
  return json({ access_token: 'test-access-token', expires_in: 3_600, token_type: 'Bearer' });
}

function gcpInstance(overrides: Record<string, unknown> = {}) {
  return {
    creationTimestamp: '2026-01-01T00:00:00.000-08:00',
    disks: [{ boot: true, licenses: ['https://compute.googleapis.com/.../licenses/ubuntu-2004-lts'] }],
    id: '1234567890',
    labels: { env: 'prod' },
    machineType: 'https://www.googleapis.com/compute/v1/projects/my-project/zones/us-central1-a/machineTypes/n1-standard-1',
    name: 'web-1',
    networkInterfaces: [{ accessConfigs: [{ natIP: '34.1.2.3' }], networkIP: '10.0.0.2' }],
    status: 'RUNNING',
    zone: 'https://www.googleapis.com/compute/v1/projects/my-project/zones/us-central1-a',
    ...overrides,
  };
}

function adapter(fetchMock: ReturnType<typeof vi.fn>, options: { readonly timeoutMs?: number; readonly maxPages?: number } = {}): GcpAdapter {
  return new GcpAdapter({ fetchImplementation: fetchMock as unknown as typeof fetch, ...options });
}

describe('GCP credential shape', () => {
  it('accepts a well-formed service-account credential', () => {
    expect(parseGcpCredential(VALID_CREDENTIAL)).toEqual({
      clientEmail: 'sa@my-project.iam.gserviceaccount.com',
      privateKey: TEST_PRIVATE_KEY_PEM,
      projectId: 'my-project',
    });
  });

  it('rejects a blank credential', () => {
    expect(() => parseGcpCredential('')).toThrow();
    expect(() => parseGcpCredential('   ')).toThrow();
  });

  it('rejects an invalid project ID', () => {
    expect(() => parseGcpCredential(JSON.stringify({ clientEmail: 'sa@x.iam.gserviceaccount.com', privateKey: TEST_PRIVATE_KEY_PEM, projectId: 'INVALID_ID' })))
      .toThrow();
  });

  it('rejects a client email that is not a service-account address', () => {
    expect(() => parseGcpCredential(JSON.stringify({ clientEmail: 'not-a-service-account@gmail.com', privateKey: TEST_PRIVATE_KEY_PEM, projectId: 'my-project' })))
      .toThrow();
  });

  it('rejects a private key missing the PEM header', () => {
    expect(() => parseGcpCredential(JSON.stringify({ clientEmail: 'sa@x.iam.gserviceaccount.com', privateKey: 'not-a-real-key', projectId: 'my-project' })))
      .toThrow();
  });

  it('rejects malformed JSON', () => {
    expect(() => parseGcpCredential('not-json')).toThrow();
  });
});

describe('GCP Compute Engine discovery', () => {
  it('mints an access token via the JWT-bearer flow before calling Compute', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({ items: {} }));
    await adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL);

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string | URL, RequestInit];
    expect(String(tokenUrl)).toBe('https://oauth2.googleapis.com/token');
    const body = new URLSearchParams(tokenInit.body as string);
    expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const assertion = body.get('assertion')!;
    const segments = assertion.split('.');
    expect(segments).toHaveLength(3);
    const [headerB64, claimsB64, signatureB64] = segments as [string, string, string];
    const claims = JSON.parse(Buffer.from(claimsB64, 'base64url').toString('utf8')) as Record<string, unknown>;
    expect(claims.iss).toBe('sa@my-project.iam.gserviceaccount.com');
    expect(claims.scope).toBe('https://www.googleapis.com/auth/compute.readonly');
    // The assertion is a genuine RS256 signature over header.claims, verifiable with the paired public key.
    expect(
      createVerify('RSA-SHA256').update(`${headerB64}.${claimsB64}`).verify(_publicKey, Buffer.from(signatureB64, 'base64url')),
    ).toBe(true);

    const [computeUrl, computeInit] = fetchMock.mock.calls[1] as [string | URL, RequestInit];
    expect(String(computeUrl)).toContain('/compute/v1/projects/my-project/aggregated/instances');
    expect((computeInit.headers as Record<string, string>).authorization).toBe('Bearer test-access-token');
  });

  it('normalizes an instance across zones, deriving region from zone', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({ items: { 'zones/us-central1-a': { instances: [gcpInstance()] } } }));
    const result = await adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL);

    expect(result).toEqual({
      completion: 'COMPLETE',
      error: null,
      externalResourceType: 'compute-instance',
      resources: [
        {
          externalResourceId: '1234567890',
          imageReference: 'https://compute.googleapis.com/.../licenses/ubuntu-2004-lts',
          instanceType: 'n1-standard-1',
          launchedAt: new Date('2026-01-01T00:00:00.000-08:00').toISOString(),
          name: 'web-1',
          privateIpAddress: '10.0.0.2',
          providerStatus: 'running',
          publicIpAddress: '34.1.2.3',
          region: 'us-central1',
          resourceGroup: null,
          resourceKind: 'compute-instance',
          tags: { env: 'prod' },
          zone: 'us-central1-a',
        },
      ],
    });
  });

  it('paginates via pageToken across multiple aggregatedList pages', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({
        items: { 'zones/us-central1-a': { instances: [gcpInstance({ id: '1' })] } },
        nextPageToken: 'page-2',
      }))
      .mockResolvedValueOnce(json({ items: { 'zones/us-central1-b': { instances: [gcpInstance({ id: '2', name: 'web-2' })] } } }));
    const result = await adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL);

    expect(result.completion).toBe('COMPLETE');
    expect(result.resources.map((r) => r.externalResourceId)).toEqual(['1', '2']);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 token mint + 2 pages
  });

  it('treats a non-empty `unreachables` list as a genuinely partial enumeration', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({
        items: { 'zones/us-central1-a': { instances: [gcpInstance()] } },
        unreachables: ['zones/us-central1-f'],
      }));
    const result = await adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL);

    expect(result.completion).toBe('PARTIAL');
    expect(result.error).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(result.resources).toHaveLength(1);
  });

  it('returns PARTIAL with data gathered so far when a later page fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({
        items: { 'zones/us-central1-a': { instances: [gcpInstance()] } },
        nextPageToken: 'page-2',
      }))
      .mockResolvedValueOnce(json({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } }, { status: 429 }));
    const result = await adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL);

    expect(result).toMatchObject({ completion: 'PARTIAL', error: { code: 'RATE_LIMITED' }, resources: [expect.objectContaining({ externalResourceId: '1234567890' })] });
  });

  it('throws (does not return a hollow PARTIAL) when the very first Compute call fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({ error: { code: 403, status: 'PERMISSION_DENIED' } }, { status: 403 }));
    await expect(adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('classifies a token-mint failure (invalid_grant) as AUTH_INVALID', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ error: 'invalid_grant' }, { status: 400 }));
    await expect(adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'AUTH_INVALID' });
  });

  it('maps a 401 identity failure on the Compute call to AUTH_INVALID', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({ error: { code: 401, status: 'UNAUTHENTICATED' } }, { status: 401 }));
    await expect(adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'AUTH_INVALID' });
  });

  it('maps a 5xx to UPSTREAM_UNAVAILABLE', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response('{}', { status: 503 }));
    await expect(adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('rejects malformed JSON', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response('{not json'));
    await expect(adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('aborts a timed-out Compute request and classifies it safely', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockImplementationOnce((_input: unknown, init?: { readonly signal?: AbortSignal | null }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('test timeout', 'AbortError'));
          });
        }));
    await expect(adapter(fetchMock, { timeoutMs: 5 }).discoverCloudResources(VALID_CREDENTIAL))
      .rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' });
  });

  it('treats an empty project as a complete empty enumeration', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({ items: {} }));
    const result = await adapter(fetchMock).discoverCloudResources(VALID_CREDENTIAL);
    expect(result).toMatchObject({ completion: 'COMPLETE', resources: [] });
  });
});
