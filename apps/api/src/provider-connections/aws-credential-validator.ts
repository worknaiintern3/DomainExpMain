import { createHash, createHmac } from 'node:crypto';

import { XMLParser } from 'fast-xml-parser';

import type { ProviderErrorCode } from './provider-connections.types';

/**
 * Minimal AWS STS credential-verification client, mirroring
 * cloudflare-token-validator.ts / namecheap-token-validator.ts: used only by
 * the connection create/validate/rotate flows, validating outside any DB
 * transaction and before persisting anything. AWS has no dedicated
 * "verify these keys" endpoint, so this calls `sts:GetCallerIdentity` --
 * the documented, zero-permission-required identity check, and the same
 * call the worker's `AwsAdapter` would use for identity validation -- via a
 * hand-implemented Signature Version 4 signer rather than the AWS SDK (see
 * apps/worker/src/providers/aws/aws.sigv4.ts's header comment for why: SigV4
 * is a small, fully documented HMAC-SHA256 chain, and every provider
 * validator in this file already authenticates with plain fetch rather than
 * a provider SDK). This is a second, independent implementation of the
 * signer and the credential shape -- not an import of apps/worker -- for the
 * same reason namecheap-token-validator.ts duplicates
 * NamecheapAdapter's credential parsing: apps/api's tsconfig rootDir cannot
 * reference apps/worker sources, and apps/worker's Phase 10D+ adapters must
 * not be modified.
 */

const STS_HOST = 'sts.amazonaws.com';
const STS_SIGNING_REGION = 'us-east-1';
const STS_API_VERSION = '2011-06-15';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_CREDENTIAL_LENGTH = 16_384;
const ACCESS_KEY_ID_PATTERN = /^[A-Z0-9]{16,128}$/u;
const REGION_PATTERN = /^[a-z]{2}-[a-z]+-\d$/u;
const MAX_SECRET_ACCESS_KEY_LENGTH = 256;
const MAX_SESSION_TOKEN_LENGTH = 8_192;
const MAX_REGIONS = 10;

const xmlParser = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  parseAttributeValue: false,
  trimValues: true,
});

export class AwsTokenValidationError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode) {
    super('AWS credential validation failed');
    this.name = 'AwsTokenValidationError';
    this.code = code;
  }
}

interface AwsCredential {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string;
}

/** Only accessKeyId/secretAccessKey/sessionToken matter for identity validation; `regions` is required by the shape but unused here (EC2 discovery, not identity, is region-scoped). */
function parseCredential(raw: string): AwsCredential {
  if (typeof raw !== 'string' || raw.trim().length === 0 || raw.length > MAX_CREDENTIAL_LENGTH) {
    throw new AwsTokenValidationError('INVALID_REQUEST');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AwsTokenValidationError('INVALID_REQUEST');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new AwsTokenValidationError('INVALID_REQUEST');
  }
  const { accessKeyId, secretAccessKey, sessionToken, regions } = parsed as Record<string, unknown>;
  if (typeof accessKeyId !== 'string' || !ACCESS_KEY_ID_PATTERN.test(accessKeyId)) {
    throw new AwsTokenValidationError('INVALID_REQUEST');
  }
  if (
    typeof secretAccessKey !== 'string' ||
    secretAccessKey.length === 0 ||
    secretAccessKey.length > MAX_SECRET_ACCESS_KEY_LENGTH
  ) {
    throw new AwsTokenValidationError('INVALID_REQUEST');
  }
  if (
    sessionToken !== undefined &&
    (typeof sessionToken !== 'string' || sessionToken.length === 0 || sessionToken.length > MAX_SESSION_TOKEN_LENGTH)
  ) {
    throw new AwsTokenValidationError('INVALID_REQUEST');
  }
  if (
    !Array.isArray(regions) ||
    regions.length === 0 ||
    regions.length > MAX_REGIONS ||
    !regions.every((region) => typeof region === 'string' && REGION_PATTERN.test(region))
  ) {
    throw new AwsTokenValidationError('INVALID_REQUEST');
  }
  return {
    accessKeyId,
    secretAccessKey,
    ...(sessionToken !== undefined ? { sessionToken: sessionToken as string } : {}),
  };
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function amzTimestamp(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}Z$/gu, '');
  return { amzDate: `${iso}Z`, dateStamp: iso.slice(0, 8) };
}

function signGetCallerIdentity(credential: AwsCredential, body: string, now: Date): Record<string, string> {
  const { amzDate, dateStamp } = amzTimestamp(now);
  const credentialScope = `${dateStamp}/${STS_SIGNING_REGION}/sts/aws4_request`;

  const canonicalHeadersEntries: [string, string][] = [
    ['content-type', 'application/x-www-form-urlencoded; charset=utf-8'],
    ['host', STS_HOST],
    ['x-amz-date', amzDate],
  ];
  if (credential.sessionToken) {
    canonicalHeadersEntries.push(['x-amz-security-token', credential.sessionToken]);
  }
  canonicalHeadersEntries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const canonicalHeaders = canonicalHeadersEntries.map(([key, value]) => `${key}:${value}\n`).join('');
  const signedHeaders = canonicalHeadersEntries.map(([key]) => key).join(';');

  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, sha256Hex(body)].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${credential.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, STS_SIGNING_REGION);
  const kService = hmac(kRegion, 'sts');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign).toString('hex');

  const headers: Record<string, string> = {
    authorization: `AWS4-HMAC-SHA256 Credential=${credential.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
    host: STS_HOST,
    'x-amz-date': amzDate,
  };
  if (credential.sessionToken) {
    headers['x-amz-security-token'] = credential.sessionToken;
  }
  return headers;
}

/**
 * Mirrors `AwsAdapter`'s numeric-code-first classification (see
 * apps/worker/src/providers/aws/aws.adapter.ts's `classifyAwsErrorCode`):
 * AWS's own stable `<Code>` element is authoritative over HTTP status.
 */
const AWS_ERROR_CODE_TO_PROVIDER_CODE: Readonly<Record<string, ProviderErrorCode>> = {
  AccessDenied: 'PERMISSION_DENIED',
  AccessDeniedException: 'PERMISSION_DENIED',
  AuthFailure: 'AUTH_INVALID',
  InvalidAction: 'INVALID_REQUEST',
  InvalidClientTokenId: 'AUTH_INVALID',
  InvalidParameterValue: 'INVALID_REQUEST',
  MissingAuthenticationToken: 'AUTH_INVALID',
  MissingParameter: 'INVALID_REQUEST',
  RequestLimitExceeded: 'RATE_LIMITED',
  SignatureDoesNotMatch: 'AUTH_INVALID',
  Throttling: 'RATE_LIMITED',
  ThrottlingException: 'RATE_LIMITED',
  UnauthorizedOperation: 'PERMISSION_DENIED',
  UnrecognizedClientException: 'AUTH_INVALID',
  ValidationError: 'INVALID_REQUEST',
};

function extractErrorCode(xmlText: string): string | undefined {
  let parsed: Record<string, unknown>;
  try {
    parsed = xmlParser.parse(xmlText) as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const error = (parsed.ErrorResponse as Record<string, unknown> | undefined)?.Error as
    | Record<string, unknown>
    | undefined;
  const code = error?.Code;
  return typeof code === 'string' ? code : undefined;
}

/** Falls back to HTTP status when the body isn't parseable XML (or has no recognized `<Code>`), mirroring `AwsAdapter.httpError`'s status fallback. */
function classifyErrorResponse(status: number, xmlText: string): ProviderErrorCode {
  const code = extractErrorCode(xmlText);
  if (code !== undefined) {
    return AWS_ERROR_CODE_TO_PROVIDER_CODE[code] ?? 'UNKNOWN_PROVIDER_ERROR';
  }
  if (status === 401) return 'AUTH_INVALID';
  if (status === 403) return 'PERMISSION_DENIED';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500 && status <= 599) return 'UPSTREAM_UNAVAILABLE';
  if (status === 400) return 'INVALID_REQUEST';
  return 'UNKNOWN_PROVIDER_ERROR';
}

export interface AwsCredentialValidatorOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly now?: () => Date;
  readonly timeoutMs?: number;
}

export class AwsCredentialValidator {
  private readonly fetchImplementation: typeof fetch;
  private readonly now: () => Date;
  private readonly timeoutMs: number;

  constructor(options: AwsCredentialValidatorOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Resolves true when `sts:GetCallerIdentity` confirms the keys authenticate a real identity, false only for a truthful "invalid keys" result, and throws for every other transport/upstream failure. */
  async isTokenActive(token: string): Promise<boolean> {
    const credential = parseCredential(token);
    const body = new URLSearchParams({ Action: 'GetCallerIdentity', Version: STS_API_VERSION }).toString();
    const headers = signGetCallerIdentity(credential, body, this.now());

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(`https://${STS_HOST}/`, {
        body,
        headers,
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      throw new AwsTokenValidationError(
        controller.signal.aborted ? 'NETWORK_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      );
    } finally {
      clearTimeout(timeout);
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new AwsTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new AwsTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new AwsTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    if (!response.ok) {
      const code = classifyErrorResponse(response.status, text);
      // "Invalid keys" is the only truthful "not active" outcome; every
      // other classification (permission/rate-limit/unknown) is a distinct
      // failure that must not be reported as an inactive credential.
      if (code === 'AUTH_INVALID') {
        return false;
      }
      throw new AwsTokenValidationError(code);
    }
    return true;
  }
}
