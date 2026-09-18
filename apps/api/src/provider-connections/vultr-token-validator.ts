import { z } from 'zod';

import type { ProviderErrorCode } from './provider-connections.types';

/**
 * Minimal Vultr credential-verification client, mirroring
 * cloudflare-token-validator.ts / godaddy-token-validator.ts: used only by
 * the connection create/validate/rotate flows, validating outside any DB
 * transaction and before persisting anything. Vultr has no dedicated
 * token-verify endpoint, so this performs the smallest real read
 * (`GET /v2/instances?per_page=1`) -- the same call the worker's
 * `VultrAdapter.validateToken` makes -- without importing apps/worker (see
 * cloudflare-token-validator.ts's header comment for why the duplication is
 * intentional and bounded).
 */

const VULTR_API_ORIGIN = 'https://api.vultr.com';
const VULTR_INSTANCES_PATH = '/v2/instances';
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_TOKEN_LENGTH = 4_096;

const instancesPageSchema = z.object({
  instances: z.array(z.unknown()),
});

export class VultrTokenValidationError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode) {
    super('Vultr token validation failed');
    this.name = 'VultrTokenValidationError';
    this.code = code;
  }
}

export interface VultrTokenValidatorOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly timeoutMs?: number;
}

export class VultrTokenValidator {
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: VultrTokenValidatorOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Resolves true when the API key authenticates a real instances read, false only for a truthful 401, and throws for every other transport/upstream failure. */
  async isTokenActive(token: string): Promise<boolean> {
    if (
      typeof token !== 'string'
      || token.trim().length === 0
      || token.length > MAX_TOKEN_LENGTH
    ) {
      throw new VultrTokenValidationError('INVALID_REQUEST');
    }

    const url = new URL(VULTR_INSTANCES_PATH, VULTR_API_ORIGIN);
    url.searchParams.set('per_page', '1');

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
      throw new VultrTokenValidationError(
        controller.signal.aborted ? 'NETWORK_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // 401: the key itself is invalid/revoked -- a truthful "not active"
      // result. 403: the key authenticates but lacks scope/IP allowlisting
      // -- a distinct, non-credential failure that must not be reported as
      // inactive.
      if (response.status === 401) {
        return false;
      }
      if (response.status === 403) {
        throw new VultrTokenValidationError('PERMISSION_DENIED');
      }
      throw new VultrTokenValidationError(this.httpErrorCode(response.status));
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new VultrTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new VultrTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new VultrTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text) as unknown;
    } catch {
      throw new VultrTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    const parsed = instancesPageSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new VultrTokenValidationError('UPSTREAM_BAD_RESPONSE');
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
