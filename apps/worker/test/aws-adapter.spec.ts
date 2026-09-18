import { describe, expect, it, vi } from 'vitest';

import { AwsAdapter, classifyAwsErrorCode, extractAwsErrorCode } from '../src/providers/aws/aws.adapter';
import { parseAwsCredential } from '../src/providers/aws/aws.constants';

const VALID_CREDENTIAL = JSON.stringify({
  accessKeyId: 'AKIAEXAMPLE12345678',
  regions: ['us-east-1', 'eu-west-1'],
  secretAccessKey: 'super-secret-value',
});

function xml(body: string, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'text/xml');
  return new Response(body, { ...init, headers });
}

function describeInstancesXml(
  instances: readonly { id: string; type?: string; state?: string; az?: string }[],
  nextToken?: string,
): string {
  const items = instances
    .map(
      (instance) => `
        <item>
          <instanceId>${instance.id}</instanceId>
          <imageId>ami-0abc</imageId>
          <instanceState><code>16</code><name>${instance.state ?? 'running'}</name></instanceState>
          <instanceType>${instance.type ?? 't3.micro'}</instanceType>
          <launchTime>2026-01-01T00:00:00.000Z</launchTime>
          <placement><availabilityZone>${instance.az ?? 'us-east-1a'}</availabilityZone></placement>
          <privateIpAddress>10.0.0.5</privateIpAddress>
          <ipAddress>1.2.3.4</ipAddress>
          <tagSet><item><key>Name</key><value>web-${instance.id}</value></item></tagSet>
        </item>`,
    )
    .join('');
  // A truly empty result has zero <reservationSet> items (matching real
  // AWS output), not a reservation wrapping an empty <instancesSet> --
  // besides being realistic, an empty <instancesSet></instancesSet> element
  // is also a known fast-xml-parser gotcha (it parses to `""`, not `{}`).
  const reservationSet = instances.length > 0
    ? `<reservationSet><item><instancesSet>${items}</instancesSet></item></reservationSet>`
    : '<reservationSet/>';
  return `<?xml version="1.0"?>
<DescribeInstancesResponse>
  ${reservationSet}
  ${nextToken ? `<nextToken>${nextToken}</nextToken>` : ''}
</DescribeInstancesResponse>`;
}

function errorXml(code: string): string {
  return `<?xml version="1.0"?><Response><Errors><Error><Code>${code}</Code><Message>failed</Message></Error></Errors><RequestID>r-1</RequestID></Response>`;
}

function adapter(fetchMock: ReturnType<typeof vi.fn>, options: { readonly timeoutMs?: number; readonly maxPages?: number } = {}): AwsAdapter {
  return new AwsAdapter({ fetchImplementation: fetchMock as unknown as typeof fetch, ...options });
}

describe('AWS credential shape', () => {
  it('accepts a well-formed credential', () => {
    expect(parseAwsCredential(VALID_CREDENTIAL)).toEqual({
      accessKeyId: 'AKIAEXAMPLE12345678',
      regions: ['us-east-1', 'eu-west-1'],
      secretAccessKey: 'super-secret-value',
    });
  });

  it('rejects a blank credential', () => {
    expect(() => parseAwsCredential('')).toThrow();
    expect(() => parseAwsCredential('   ')).toThrow();
  });

  it('rejects a credential missing regions', () => {
    expect(() => parseAwsCredential(JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', secretAccessKey: 'x' })))
      .toThrow();
  });

  it('rejects an empty regions array and a malformed region code', () => {
    expect(() => parseAwsCredential(JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: [], secretAccessKey: 'x' })))
      .toThrow();
    expect(() => parseAwsCredential(JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['not-a-region'], secretAccessKey: 'x' })))
      .toThrow();
  });

  it('de-duplicates repeated regions', () => {
    const credential = parseAwsCredential(
      JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['us-east-1', 'us-east-1'], secretAccessKey: 'x' }),
    );
    expect(credential.regions).toEqual(['us-east-1']);
  });

  it('accepts an optional session token', () => {
    const credential = parseAwsCredential(
      JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['us-east-1'], secretAccessKey: 'x', sessionToken: 'temp-token' }),
    );
    expect(credential.sessionToken).toBe('temp-token');
  });

  it('rejects malformed JSON and non-object credentials', () => {
    expect(() => parseAwsCredential('not-json')).toThrow();
    expect(() => parseAwsCredential('null')).toThrow();
    expect(() => parseAwsCredential('42')).toThrow();
  });
});

describe('AWS error classification', () => {
  it('maps known AWS error codes to canonical provider error codes', () => {
    expect(classifyAwsErrorCode('InvalidClientTokenId')).toBe('AUTH_INVALID');
    expect(classifyAwsErrorCode('SignatureDoesNotMatch')).toBe('AUTH_INVALID');
    expect(classifyAwsErrorCode('UnauthorizedOperation')).toBe('PERMISSION_DENIED');
    expect(classifyAwsErrorCode('AccessDenied')).toBe('PERMISSION_DENIED');
    expect(classifyAwsErrorCode('RequestLimitExceeded')).toBe('RATE_LIMITED');
    expect(classifyAwsErrorCode('Throttling')).toBe('RATE_LIMITED');
    expect(classifyAwsErrorCode('ValidationError')).toBe('INVALID_REQUEST');
    expect(classifyAwsErrorCode('SomeUnknownCode')).toBe('UNKNOWN_PROVIDER_ERROR');
    expect(classifyAwsErrorCode(undefined)).toBe('UNKNOWN_PROVIDER_ERROR');
  });

  it('extracts the AWS error code from an EC2-style error envelope', () => {
    expect(extractAwsErrorCode(errorXml('InvalidClientTokenId'))).toBe('InvalidClientTokenId');
  });

  it('returns undefined for malformed XML rather than throwing', () => {
    expect(extractAwsErrorCode('{not xml')).toBeUndefined();
  });
});

describe('AWS EC2 discovery', () => {
  it('normalizes a single-region, single-page response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(xml(describeInstancesXml([{ id: 'i-1' }])));
    const result = await adapter(fetchMock).discoverCloudResources(
      JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['us-east-1'], secretAccessKey: 'x' }),
    );

    expect(result.completion).toBe('COMPLETE');
    expect(result.error).toBeNull();
    expect(result.externalResourceType).toBe('ec2-instance');
    expect(result.resources).toEqual([
      {
        externalResourceId: 'i-1',
        imageReference: 'ami-0abc',
        instanceType: 't3.micro',
        launchedAt: '2026-01-01T00:00:00.000Z',
        name: 'web-i-1',
        privateIpAddress: '10.0.0.5',
        providerStatus: 'running',
        publicIpAddress: '1.2.3.4',
        region: 'us-east-1',
        resourceGroup: null,
        resourceKind: 'ec2-instance',
        tags: { Name: 'web-i-1' },
        zone: 'us-east-1a',
      },
    ]);
  });

  it('signs the request with SigV4 headers and never follows a redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue(xml(describeInstancesXml([])));
    await adapter(fetchMock).discoverCloudResources(
      JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['us-east-1'], secretAccessKey: 'x' }),
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ec2.us-east-1.amazonaws.com/');
    expect(init.redirect).toBe('error');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE12345678\//);
    expect(headers['x-amz-date']).toBeDefined();
  });

  it('includes the session token header when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(xml(describeInstancesXml([])));
    await adapter(fetchMock).discoverCloudResources(
      JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['us-east-1'], secretAccessKey: 'x', sessionToken: 'temp-token' }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-amz-security-token']).toBe('temp-token');
  });

  it('paginates within a region via NextToken', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(xml(describeInstancesXml([{ id: 'i-1' }], 'page-2')))
      .mockResolvedValueOnce(xml(describeInstancesXml([{ id: 'i-2' }])));
    const result = await adapter(fetchMock).discoverCloudResources(
      JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['us-east-1'], secretAccessKey: 'x' }),
    );
    expect(result.completion).toBe('COMPLETE');
    expect(result.resources.map((r) => r.externalResourceId)).toEqual(['i-1', 'i-2']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('enumerates every configured region and tags each resource with its own region', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(xml(describeInstancesXml([{ id: 'i-east', az: 'us-east-1a' }])))
      .mockResolvedValueOnce(xml(describeInstancesXml([{ id: 'i-west', az: 'eu-west-1a' }])));
    const result = await adapter(fetchMock).discoverCloudResources(
      JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['us-east-1', 'eu-west-1'], secretAccessKey: 'x' }),
    );
    expect(result.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalResourceId: 'i-east', region: 'us-east-1' }),
        expect.objectContaining({ externalResourceId: 'i-west', region: 'eu-west-1' }),
      ]),
    );
    const urls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(urls).toEqual(['https://ec2.us-east-1.amazonaws.com/', 'https://ec2.eu-west-1.amazonaws.com/']);
  });

  it('returns PARTIAL with data gathered so far when a later region fails, never throwing away prior pages', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(xml(describeInstancesXml([{ id: 'i-1' }])))
      .mockResolvedValueOnce(xml(errorXml('Throttling'), { status: 429 }));
    const result = await adapter(fetchMock).discoverCloudResources(
      JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['us-east-1', 'eu-west-1'], secretAccessKey: 'x' }),
    );
    expect(result).toMatchObject({
      completion: 'PARTIAL',
      error: { code: 'RATE_LIMITED' },
      resources: [expect.objectContaining({ externalResourceId: 'i-1' })],
    });
  });

  it('throws (does not return a hollow PARTIAL) when the very first call fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(xml(errorXml('InvalidClientTokenId'), { status: 401 }));
    await expect(
      adapter(fetchMock).discoverCloudResources(
        JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['us-east-1'], secretAccessKey: 'x' }),
      ),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID' });
  });

  it.each([
    ['AccessDenied', 'PERMISSION_DENIED'],
    ['SignatureDoesNotMatch', 'AUTH_INVALID'],
    ['RequestLimitExceeded', 'RATE_LIMITED'],
  ] as const)('classifies error code %s as %s on the first call', async (code, expected) => {
    const fetchMock = vi.fn().mockResolvedValue(xml(errorXml(code), { status: 400 }));
    await expect(
      adapter(fetchMock).discoverCloudResources(
        JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['us-east-1'], secretAccessKey: 'x' }),
      ),
    ).rejects.toMatchObject({ code: expected });
  });

  it('maps a 5xx without a recognizable AWS error code to UPSTREAM_UNAVAILABLE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('internal error', { status: 503 }));
    await expect(
      adapter(fetchMock).discoverCloudResources(
        JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['us-east-1'], secretAccessKey: 'x' }),
      ),
    ).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('rejects malformed XML', async () => {
    await expect(
      adapter(vi.fn().mockResolvedValue(xml('{not xml'))).discoverCloudResources(
        JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['us-east-1'], secretAccessKey: 'x' }),
      ),
    ).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('aborts a timed-out request and classifies it safely', async () => {
    const fetchMock = vi.fn((_input: unknown, init?: { readonly signal?: AbortSignal | null }) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('test timeout', 'AbortError'));
        });
      }));
    await expect(
      adapter(fetchMock, { timeoutMs: 5 }).discoverCloudResources(
        JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['us-east-1'], secretAccessKey: 'x' }),
      ),
    ).rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' });
  });

  it('treats an empty account as a complete empty enumeration', async () => {
    const result = await adapter(vi.fn().mockResolvedValue(xml(describeInstancesXml([])))).discoverCloudResources(
      JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['us-east-1'], secretAccessKey: 'x' }),
    );
    expect(result).toMatchObject({ completion: 'COMPLETE', resources: [] });
  });
});
