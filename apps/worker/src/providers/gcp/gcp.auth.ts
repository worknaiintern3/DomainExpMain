import { Buffer } from 'node:buffer';
import { createSign } from 'node:crypto';

import { ProviderAdapterError } from '../provider.errors';
import {
  GCP_JWT_GRANT_TYPE,
  GCP_JWT_LIFETIME_SECONDS,
  GCP_OAUTH_TOKEN_ORIGIN,
  GCP_OAUTH_TOKEN_PATH,
  type GcpCredential,
} from './gcp.constants';

/**
 * Mints a short-lived OAuth2 access token from a GCP service-account key via
 * the documented "JWT Bearer Token" server-to-server flow (RFC 7523): a
 * self-signed RS256 JWT asserting the service account's identity and the
 * requested scope, exchanged at Google's fixed token endpoint. Implemented
 * with Node's built-in `crypto` (RSA-SHA256 signing) rather than the
 * `googleapis`/`google-auth-library` packages -- the algorithm is a small,
 * fully documented signing + token-exchange sequence, and every other
 * provider adapter in this codebase authenticates with plain fetch rather
 * than a provider SDK.
 */

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export interface GcpAccessToken {
  readonly accessToken: string;
  readonly expiresAt: number;
}

export interface GcpAuthOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly now?: () => number;
  readonly timeoutMs?: number;
}

interface GcpTokenErrorBody {
  readonly error?: string;
  readonly error_description?: string;
}

export class GcpAuthClient {
  private readonly fetchImplementation: typeof fetch;
  private readonly nowMs: () => number;
  private readonly timeoutMs: number;

  constructor(options: GcpAuthOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.nowMs = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async mintAccessToken(credential: GcpCredential, scope: string): Promise<GcpAccessToken> {
    const nowSeconds = Math.floor(this.nowMs() / 1_000);
    const expiresAt = nowSeconds + GCP_JWT_LIFETIME_SECONDS;
    const header = { alg: 'RS256', typ: 'JWT' };
    const claims = {
      aud: `${GCP_OAUTH_TOKEN_ORIGIN}${GCP_OAUTH_TOKEN_PATH}`,
      exp: expiresAt,
      iat: nowSeconds,
      iss: credential.clientEmail,
      scope,
    };
    const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;

    let signature: string;
    try {
      signature = createSign('RSA-SHA256').update(signingInput).sign(credential.privateKey, 'base64url');
    } catch {
      // A malformed/corrupt private key is a credential problem, not a
      // network one -- classified as AUTH_INVALID, not a transport failure.
      throw new ProviderAdapterError('AUTH_INVALID');
    }
    const assertion = `${signingInput}.${signature}`;

    const body = new URLSearchParams({ assertion, grant_type: GCP_JWT_GRANT_TYPE }).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(
        new URL(GCP_OAUTH_TOKEN_PATH, GCP_OAUTH_TOKEN_ORIGIN),
        {
          body,
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
        },
      );
    } catch {
      throw new ProviderAdapterError(
        controller.signal.aborted ? 'NETWORK_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      );
    } finally {
      clearTimeout(timeout);
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    if (Buffer.byteLength(text, 'utf8') > 1_000_000) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }

    // Status-based classification runs before the JSON parse attempt: a
    // throttled/5xx response is not guaranteed to have any body at all, and
    // that must still classify by status rather than as a parse failure.
    if (!response.ok) {
      if (response.status === 429) throw new ProviderAdapterError('RATE_LIMITED');
      if (response.status >= 500) throw new ProviderAdapterError('UPSTREAM_UNAVAILABLE');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }

    if (!response.ok) {
      const errorBody = parsed as GcpTokenErrorBody;
      // Google's token-endpoint errors (invalid_grant, invalid_client, ...)
      // are fundamentally statements about the key/assertion, not the
      // network -- classified as AUTH_INVALID regardless of the specific
      // `error` value.
      if (typeof errorBody.error === 'string') {
        throw new ProviderAdapterError('AUTH_INVALID');
      }
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }

    const accessToken = (parsed as { access_token?: unknown }).access_token;
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    return { accessToken, expiresAt };
  }
}
