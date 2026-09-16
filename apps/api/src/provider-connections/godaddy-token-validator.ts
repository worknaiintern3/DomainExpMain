import { z } from 'zod';

import type { ProviderErrorCode } from './provider-connections.types';

/**
 * Minimal GoDaddy credential-verification client, mirroring
 * cloudflare-token-validator.ts: used only by the connection
 * create/validate/rotate flows, validating outside any DB transaction and
 * before persisting anything. GoDaddy has no dedicated token-verify
 * endpoint, so this performs the smallest real Domains v1 read
 * (`GET /v1/domains?limit=1`) -- the same call the worker's
 * `GoDaddyAdapter.validateToken` makes -- without importing apps/worker (see
 * cloudflare-token-validator.ts's header comment for why the duplication is
 * intentional and bounded).
 */

const GODADDY_API_ORIGIN = 'https://api.godaddy.com';
const GODADDY_DOMAINS_PATH = '/v1/domains';
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_TOKEN_LENGTH = 4_096;

const domainListEntrySchema = z.object({
  domain: z.string().min(1).max(253),
});
const domainListSchema = z.array(domainListEntrySchema);

export class GoDaddyTokenValidationError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode) {
    super('GoDaddy token validation failed');
    this.name = 'GoDaddyTokenValidationError';
    this.code = code;
  }
}

export interface GoDaddyTokenValidatorOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly timeoutMs?: number;
}

export class GoDaddyTokenValidator {
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: GoDaddyTokenValidatorOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Resolves true when the token authenticates a real domain read, false only for a truthful 401, and throws for every other transport/upstream failure. */
  async isTokenActive(token: string): Promise<boolean> {
    if (
      typeof token !== 'string'
      || token.trim().length === 0
      || token.length > MAX_TOKEN_LENGTH
    ) {
      throw new GoDaddyTokenValidationError('INVALID_REQUEST');
    }

    const url = new URL(GODADDY_DOMAINS_PATH, GODADDY_API_ORIGIN);
    url.searchParams.set('limit', '1');

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      throw new GoDaddyTokenValidationError(
        controller.signal.aborted ? 'NETWORK_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // 401: the token itself is invalid/revoked -- a truthful "not active"
      // result. 403: the token authenticates but lacks scope -- a distinct,
      // non-credential failure that must not be reported as inactive.
      if (response.status === 401) {
        return false;
      }
      if (response.status === 403) {
        throw new GoDaddyTokenValidationError('PERMISSION_DENIED');
      }
      throw new GoDaddyTokenValidationError(this.httpErrorCode(response.status));
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new GoDaddyTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new GoDaddyTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new GoDaddyTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text) as unknown;
    } catch {
      throw new GoDaddyTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    const parsed = domainListSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new GoDaddyTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    return true;
  }

  private httpErrorCode(status: number): ProviderErrorCode {
    if (status === 429) return 'RATE_LIMITED';
    if (status >= 500 && status <= 599) return 'UPSTREAM_UNAVAILABLE';
    if (status === 400) return 'INVALID_REQUEST';
    if (status === 404) return 'RESOURCE_NOT_FOUND';
    return 'UNKNOWN_PROVIDER_ERROR';
  }
}
