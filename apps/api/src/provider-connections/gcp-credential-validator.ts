import { Buffer } from 'node:buffer';
import { createSign } from 'node:crypto';

import type { ProviderErrorCode } from './provider-connections.types';

/**
 * Minimal GCP credential-verification client, mirroring
 * aws-credential-validator.ts / namecheap-token-validator.ts: used only by
 * the connection create/validate/rotate flows, validating outside any DB
 * transaction and before persisting anything. GCP has no dedicated
 * "verify this service account" endpoint, so this mints a real OAuth access
 * token from the service-account key (the same JWT-bearer flow the worker's
 * `GcpAdapter` uses) and performs the smallest real Compute Engine read --
 * `instances.aggregatedList` with `maxResults=1` -- against the exact API
 * surface Phase 10I sync uses, so a successful validation is a truthful
 * statement about both the key and project access. This is a second,
 * independent implementation of the JWT-mint step (not an import of
 * apps/worker) for the same reason namecheap-token-validator.ts duplicates
 * NamecheapAdapter's credential parsing.
 */

const GCP_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GCP_COMPUTE_API_ORIGIN = 'https://compute.googleapis.com';
const GCP_COMPUTE_READONLY_SCOPE = 'https://www.googleapis.com/auth/compute.readonly';
const GCP_JWT_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer';
const GCP_JWT_LIFETIME_SECONDS = 3_600;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_CREDENTIAL_LENGTH = 32_768;
const PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/u;

export class GcpTokenValidationError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode) {
    super('GCP credential validation failed');
    this.name = 'GcpTokenValidationError';
    this.code = code;
  }
}

interface GcpCredential {
  readonly clientEmail: string;
  readonly privateKey: string;
  readonly projectId: string;
}

function parseCredential(raw: string): GcpCredential {
  if (typeof raw !== 'string' || raw.trim().length === 0 || raw.length > MAX_CREDENTIAL_LENGTH) {
    throw new GcpTokenValidationError('INVALID_REQUEST');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GcpTokenValidationError('INVALID_REQUEST');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new GcpTokenValidationError('INVALID_REQUEST');
  }
  const { projectId, clientEmail, privateKey } = parsed as Record<string, unknown>;
  if (typeof projectId !== 'string' || !PROJECT_ID_PATTERN.test(projectId)) {
    throw new GcpTokenValidationError('INVALID_REQUEST');
  }
  if (typeof clientEmail !== 'string' || !EMAIL_PATTERN.test(clientEmail)) {
    throw new GcpTokenValidationError('INVALID_REQUEST');
  }
  if (typeof privateKey !== 'string' || !privateKey.includes('BEGIN PRIVATE KEY') || privateKey.length > 8_192) {
    throw new GcpTokenValidationError('INVALID_REQUEST');
  }
  return { clientEmail, privateKey, projectId };
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export interface GcpCredentialValidatorOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly now?: () => number;
  readonly timeoutMs?: number;
}

export class GcpCredentialValidator {
  private readonly fetchImplementation: typeof fetch;
  private readonly nowMs: () => number;
  private readonly timeoutMs: number;

  constructor(options: GcpCredentialValidatorOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.nowMs = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Resolves true when the key mints a token that can list Compute instances in the named project, false only for a truthful "invalid key" result, and throws for every other transport/upstream/access failure. */
  async isTokenActive(token: string): Promise<boolean> {
    const credential = parseCredential(token);
    let accessToken: string;
    try {
      accessToken = await this.mintAccessToken(credential);
    } catch (error) {
      if (error instanceof GcpTokenValidationError && error.code === 'AUTH_INVALID') {
        return false;
      }
      throw error;
    }

    const url = new URL(`/compute/v1/projects/${credential.projectId}/aggregated/instances`, GCP_COMPUTE_API_ORIGIN);
    url.searchParams.set('maxResults', '1');
    url.searchParams.set('returnPartialSuccess', 'true');

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        headers: { authorization: `Bearer ${accessToken}` },
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      throw new GcpTokenValidationError(
        controller.signal.aborted ? 'NETWORK_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      );
    } finally {
      clearTimeout(timeout);
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new GcpTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new GcpTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new GcpTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    if (!response.ok) {
      let status: string | undefined;
      try {
        const parsed = JSON.parse(text) as { error?: { status?: unknown } };
        status = typeof parsed.error?.status === 'string' ? parsed.error.status : undefined;
      } catch {
        // fall through to HTTP-status-only classification below
      }
      if (response.status === 403 || status === 'PERMISSION_DENIED') {
        throw new GcpTokenValidationError('PERMISSION_DENIED');
      }
      if (response.status === 404 || status === 'NOT_FOUND') {
        throw new GcpTokenValidationError('RESOURCE_NOT_FOUND');
      }
      if (response.status === 429 || status === 'RESOURCE_EXHAUSTED') {
        throw new GcpTokenValidationError('RATE_LIMITED');
      }
      if (response.status >= 500) {
        throw new GcpTokenValidationError('UPSTREAM_UNAVAILABLE');
      }
      throw new GcpTokenValidationError('UNKNOWN_PROVIDER_ERROR');
    }
    return true;
  }

  private async mintAccessToken(credential: GcpCredential): Promise<string> {
    const nowSeconds = Math.floor(this.nowMs() / 1_000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claims = {
      aud: GCP_OAUTH_TOKEN_URL,
      exp: nowSeconds + GCP_JWT_LIFETIME_SECONDS,
      iat: nowSeconds,
      iss: credential.clientEmail,
      scope: GCP_COMPUTE_READONLY_SCOPE,
    };
    const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;

    let signature: string;
    try {
      signature = createSign('RSA-SHA256').update(signingInput).sign(credential.privateKey, 'base64url');
    } catch {
      throw new GcpTokenValidationError('AUTH_INVALID');
    }
    const assertion = `${signingInput}.${signature}`;
    const body = new URLSearchParams({ assertion, grant_type: GCP_JWT_GRANT_TYPE }).toString();

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(GCP_OAUTH_TOKEN_URL, {
        body,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      throw new GcpTokenValidationError(
        controller.signal.aborted ? 'NETWORK_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      );
    } finally {
      clearTimeout(timeout);
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new GcpTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new GcpTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    // Status-based classification runs before the JSON parse attempt: a
    // throttled/5xx response is not guaranteed to have any body at all, and
    // that must still classify by status rather than as a parse failure.
    if (!response.ok) {
      if (response.status === 429) throw new GcpTokenValidationError('RATE_LIMITED');
      if (response.status >= 500) throw new GcpTokenValidationError('UPSTREAM_UNAVAILABLE');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new GcpTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    if (!response.ok) {
      const errorField = (parsed as { error?: unknown }).error;
      if (typeof errorField === 'string') {
        throw new GcpTokenValidationError('AUTH_INVALID');
      }
      throw new GcpTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    const accessToken = (parsed as { access_token?: unknown }).access_token;
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new GcpTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    return accessToken;
  }
}
