import { describe, expect, it, vi } from 'vitest';

import { AwsCredentialValidator, AwsTokenValidationError } from '../src/provider-connections/aws-credential-validator';

const VALID_CREDENTIAL = JSON.stringify({
  accessKeyId: 'AKIAEXAMPLE12345678',
  regions: ['us-east-1'],
  secretAccessKey: 'super-secret-value',
});

function xmlResponse(body: string, status = 200): Response {
  return new Response(body, { headers: { 'content-type': 'text/xml' }, status });
}

function callerIdentityXml(): string {
  return '<?xml version="1.0"?><GetCallerIdentityResponse><GetCallerIdentityResult><Account>123456789012</Account><Arn>arn:aws:iam::123456789012:user/test</Arn><UserId>AIDAEXAMPLE</UserId></GetCallerIdentityResult></GetCallerIdentityResponse>';
}

function errorXml(code: string): string {
  return `<?xml version="1.0"?><ErrorResponse><Error><Code>${code}</Code><Message>failed</Message></Error></ErrorResponse><RequestId>r-1</RequestId>`;
}

function fetchReturning(response: Response): typeof fetch {
  return vi.fn().mockResolvedValue(response) as typeof fetch;
}

describe('AwsCredentialValidator', () => {
  it('returns true when GetCallerIdentity succeeds', async () => {
    const validator = new AwsCredentialValidator({ fetchImplementation: fetchReturning(xmlResponse(callerIdentityXml())) });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).resolves.toBe(true);
  });

  it('signs the request with SigV4 headers against the global STS host and never follows a redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue(xmlResponse(callerIdentityXml()));
    const validator = new AwsCredentialValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await validator.isTokenActive(VALID_CREDENTIAL);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sts.amazonaws.com/');
    expect(init.redirect).toBe('error');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE12345678\/\d{8}\/us-east-1\/sts\/aws4_request/);
    const body = new URLSearchParams(init.body as string);
    expect(body.get('Action')).toBe('GetCallerIdentity');
  });

  it('maps an InvalidClientTokenId error to a truthful "not active" result, not a thrown error', async () => {
    const validator = new AwsCredentialValidator({
      fetchImplementation: fetchReturning(xmlResponse(errorXml('InvalidClientTokenId'), 403)),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).resolves.toBe(false);
  });

  it('maps SignatureDoesNotMatch to a truthful "not active" result', async () => {
    const validator = new AwsCredentialValidator({
      fetchImplementation: fetchReturning(xmlResponse(errorXml('SignatureDoesNotMatch'), 403)),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).resolves.toBe(false);
  });

  it('maps AccessDenied to a distinct PERMISSION_DENIED error, never conflated with invalid keys', async () => {
    const validator = new AwsCredentialValidator({
      fetchImplementation: fetchReturning(xmlResponse(errorXml('AccessDenied'), 403)),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toBeInstanceOf(AwsTokenValidationError);
  });

  it('maps Throttling to RATE_LIMITED', async () => {
    const validator = new AwsCredentialValidator({
      fetchImplementation: fetchReturning(xmlResponse(errorXml('Throttling'), 400)),
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('maps a 5xx response to UPSTREAM_UNAVAILABLE', async () => {
    const validator = new AwsCredentialValidator({ fetchImplementation: fetchReturning(new Response('', { status: 503 })) });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('maps an aborted request (timeout) to NETWORK_TIMEOUT', async () => {
    const validator = new AwsCredentialValidator({
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

  it('maps a network-level fetch failure (no abort) to UPSTREAM_UNAVAILABLE', async () => {
    const validator = new AwsCredentialValidator({
      fetchImplementation: vi.fn().mockRejectedValue(new Error('getaddrinfo failure')) as unknown as typeof fetch,
    });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('treats a 200 response as successful even if the body is not valid XML (only the HTTP status gates success)', async () => {
    const validator = new AwsCredentialValidator({ fetchImplementation: fetchReturning(xmlResponse('not xml at all', 200)) });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).resolves.toBe(true);
  });

  it('classifies a non-XML error body via HTTP status when the AWS error code cannot be extracted', async () => {
    const validator = new AwsCredentialValidator({ fetchImplementation: fetchReturning(new Response('not xml', { status: 403 })) });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('rejects a blank credential before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    const validator = new AwsCredentialValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await expect(validator.isTokenActive('')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a credential missing regions before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    const validator = new AwsCredentialValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await expect(
      validator.isTokenActive(JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', secretAccessKey: 'x' })),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a body over the response size bound', async () => {
    const oversized = `<?xml version="1.0"?><GetCallerIdentityResponse>${'x'.repeat(2_000_000)}</GetCallerIdentityResponse>`;
    const validator = new AwsCredentialValidator({ fetchImplementation: fetchReturning(xmlResponse(oversized)) });
    await expect(validator.isTokenActive(VALID_CREDENTIAL)).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('never sends the plaintext secret access key in the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(xmlResponse(callerIdentityXml()));
    const validator = new AwsCredentialValidator({ fetchImplementation: fetchMock as unknown as typeof fetch });
    await validator.isTokenActive(VALID_CREDENTIAL);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).not.toContain('super-secret-value');
  });
});
