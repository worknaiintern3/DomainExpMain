import { z } from 'zod';

import type { ProviderErrorCode } from './provider-connections.types';

/**
 * Minimal Hetzner Cloud credential-verification client, mirroring
 * cloudflare-token-validator.ts / godaddy-token-validator.ts: used only by
 * the connection create/validate/rotate flows, validating outside any DB
 * transaction and before persisting anything. Hetzner Cloud has no
 * dedicated token-verify endpoint, so this performs the smallest real,
 * always-permitted read (`GET /v1/locations?per_page=1`) -- the same call
 * the worker's `HetznerAdapter.validateToken` makes -- without importing
 * apps/worker (see cloudflare-token-validator.ts's header comment for why
 * the duplication is intentional and bounded).
 */

const HETZNER_API_ORIGIN = 'https://api.hetzner.cloud';
const HETZNER_LOCATIONS_PATH = '/v1/locations';
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_TOKEN_LENGTH = 4_096;

const locationsPageSchema = z.object({
  locations: z.array(z.object({ id: z.number().int() })),
});

export class HetznerTokenValidationError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode) {
    super('Hetzner token validation failed');
    this.name = 'HetznerTokenValidationError';
    this.code = code;
  }
}

export interface HetznerTokenValidatorOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly timeoutMs?: number;
}

export class HetznerTokenValidator {
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: HetznerTokenValidatorOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Resolves true when the token authenticates a real locations read, false only for a truthful 401, and throws for every other transport/upstream failure. */
  async isTokenActive(token: string): Promise<boolean> {
    if (
      typeof token !== 'string'
      || token.trim().length === 0
      || token.length > MAX_TOKEN_LENGTH
    ) {
      throw new HetznerTokenValidationError('INVALID_REQUEST');
    }

    const url = new URL(HETZNER_LOCATIONS_PATH, HETZNER_API_ORIGIN);
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
      throw new HetznerTokenValidationError(
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
        throw new HetznerTokenValidationError('PERMISSION_DENIED');
      }
      throw new HetznerTokenValidationError(this.httpErrorCode(response.status));
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new HetznerTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new HetznerTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new HetznerTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text) as unknown;
    } catch {
      throw new HetznerTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    const parsed = locationsPageSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new HetznerTokenValidationError('UPSTREAM_BAD_RESPONSE');
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
