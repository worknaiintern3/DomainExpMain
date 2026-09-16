import { z } from 'zod';

import type { ProviderErrorCode } from './provider-connections.types';

/**
 * Minimal Hostinger credential-verification client, mirroring
 * cloudflare-token-validator.ts / godaddy-token-validator.ts: used only by
 * the connection create/validate/rotate flows, validating outside any DB
 * transaction and before persisting anything. Hostinger has no dedicated
 * verify endpoint, so this performs the same portfolio read the worker's
 * `HostingerAdapter.validateToken` makes -- without importing apps/worker.
 * The portfolio endpoint has no pagination parameters (see
 * apps/worker/src/providers/hostinger/hostinger.constants.ts), so there is
 * no smaller page size to request here.
 */

const HOSTINGER_API_ORIGIN = 'https://developers.hostinger.com';
const HOSTINGER_DOMAINS_PORTFOLIO_PATH = '/api/domains/v1/portfolio';
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 4_000_000;
const MAX_TOKEN_LENGTH = 4_096;

const domainEntrySchema = z.object({
  domain: z.string().min(1).max(253),
});
const domainListSchema = z.array(domainEntrySchema);

export class HostingerTokenValidationError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode) {
    super('Hostinger token validation failed');
    this.name = 'HostingerTokenValidationError';
    this.code = code;
  }
}

export interface HostingerTokenValidatorOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly timeoutMs?: number;
}

export class HostingerTokenValidator {
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: HostingerTokenValidatorOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Resolves true when the token can read the domain portfolio, false only for a truthful 401, and throws for every other transport/upstream failure. */
  async isTokenActive(token: string): Promise<boolean> {
    if (
      typeof token !== 'string'
      || token.trim().length === 0
      || token.length > MAX_TOKEN_LENGTH
    ) {
      throw new HostingerTokenValidationError('INVALID_REQUEST');
    }

    const url = new URL(HOSTINGER_DOMAINS_PORTFOLIO_PATH, HOSTINGER_API_ORIGIN);

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
      throw new HostingerTokenValidationError(
        controller.signal.aborted ? 'NETWORK_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 401) {
        return false;
      }
      if (response.status === 403) {
        throw new HostingerTokenValidationError('PERMISSION_DENIED');
      }
      throw new HostingerTokenValidationError(this.httpErrorCode(response.status));
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new HostingerTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new HostingerTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new HostingerTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text) as unknown;
    } catch {
      throw new HostingerTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    const parsed = domainListSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new HostingerTokenValidationError('UPSTREAM_BAD_RESPONSE');
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
