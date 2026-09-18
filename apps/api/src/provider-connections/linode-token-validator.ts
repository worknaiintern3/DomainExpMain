import { z } from 'zod';

import type { ProviderErrorCode } from './provider-connections.types';

/**
 * Minimal Linode/Akamai credential-verification client, mirroring
 * cloudflare-token-validator.ts / godaddy-token-validator.ts: used only by
 * the connection create/validate/rotate flows, validating outside any DB
 * transaction and before persisting anything. Linode has no dedicated
 * token-verify endpoint, so this performs the smallest real read
 * (`GET /v4/linode/instances?page_size=25`) -- the same call the worker's
 * `LinodeAdapter.validateToken` makes -- without importing apps/worker (see
 * cloudflare-token-validator.ts's header comment for why the duplication is
 * intentional and bounded).
 */

const LINODE_API_ORIGIN = 'https://api.linode.com';
const LINODE_INSTANCES_PATH = '/v4/linode/instances';
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_TOKEN_LENGTH = 4_096;
const MIN_PAGE_SIZE = 25;

const instancesPageSchema = z.object({
  data: z.array(z.unknown()),
});

export class LinodeTokenValidationError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode) {
    super('Linode token validation failed');
    this.name = 'LinodeTokenValidationError';
    this.code = code;
  }
}

export interface LinodeTokenValidatorOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly timeoutMs?: number;
}

export class LinodeTokenValidator {
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: LinodeTokenValidatorOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Resolves true when the token authenticates a real instances read, false only for a truthful 401, and throws for every other transport/upstream failure. */
  async isTokenActive(token: string): Promise<boolean> {
    if (
      typeof token !== 'string'
      || token.trim().length === 0
      || token.length > MAX_TOKEN_LENGTH
    ) {
      throw new LinodeTokenValidationError('INVALID_REQUEST');
    }

    const url = new URL(LINODE_INSTANCES_PATH, LINODE_API_ORIGIN);
    url.searchParams.set('page', '1');
    url.searchParams.set('page_size', String(MIN_PAGE_SIZE));

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
      throw new LinodeTokenValidationError(
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
        throw new LinodeTokenValidationError('PERMISSION_DENIED');
      }
      throw new LinodeTokenValidationError(this.httpErrorCode(response.status));
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new LinodeTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new LinodeTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new LinodeTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text) as unknown;
    } catch {
      throw new LinodeTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    const parsed = instancesPageSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new LinodeTokenValidationError('UPSTREAM_BAD_RESPONSE');
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
