import { z } from 'zod';

import type { ProviderErrorCode } from './provider-connections.types';

/**
 * Minimal Cloudflare token-verification client used only by the connection
 * create/validate/rotate flows, which must validate a token outside any DB
 * transaction and before persisting anything. This intentionally covers only
 * `/user/tokens/verify` (no zone discovery) — the full adapter with domain
 * discovery is apps/worker's Phase 10D `CloudflareAdapter`, which apps/api
 * cannot import (see provider-connections.types.ts) and must not duplicate
 * beyond this narrow, independently-timed-out token check.
 */

const CLOUDFLARE_API_ORIGIN = 'https://api.cloudflare.com';
const CLOUDFLARE_TOKEN_VERIFY_PATH = '/client/v4/user/tokens/verify';
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_TOKEN_LENGTH = 4_096;

const tokenResultSchema = z.object({
  status: z.enum(['active', 'disabled', 'expired']),
});

const tokenEnvelopeSchema = z.object({
  result: tokenResultSchema.optional(),
  success: z.boolean(),
});

export class CloudflareTokenValidationError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode) {
    super('Cloudflare token validation failed');
    this.name = 'CloudflareTokenValidationError';
    this.code = code;
  }
}

export interface CloudflareTokenValidatorOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly timeoutMs?: number;
}

export class CloudflareTokenValidator {
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: CloudflareTokenValidatorOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Resolves true when the token is active, false when Cloudflare rejects it as invalid/disabled/expired, and throws for transport/upstream failures. */
  async isTokenActive(token: string): Promise<boolean> {
    if (
      typeof token !== 'string'
      || token.trim().length === 0
      || token.length > MAX_TOKEN_LENGTH
    ) {
      throw new CloudflareTokenValidationError('INVALID_REQUEST');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(
        `${CLOUDFLARE_API_ORIGIN}${CLOUDFLARE_TOKEN_VERIFY_PATH}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          redirect: 'error',
          signal: controller.signal,
        },
      );
    } catch {
      throw new CloudflareTokenValidationError(
        controller.signal.aborted ? 'NETWORK_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // 401: the token itself is invalid/disabled/expired -- a truthful
      // "not active" result. 403: the token is well-formed and authenticates,
      // but lacks the required permission -- a distinct, non-credential
      // failure that must not be reported as an inactive token.
      if (response.status === 401) {
        return false;
      }
      if (response.status === 403) {
        throw new CloudflareTokenValidationError('PERMISSION_DENIED');
      }
      throw new CloudflareTokenValidationError(this.httpErrorCode(response.status));
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new CloudflareTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new CloudflareTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text) as unknown;
    } catch {
      throw new CloudflareTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    const parsed = tokenEnvelopeSchema.safeParse(parsedJson);
    if (!parsed.success || !parsed.data.success || !parsed.data.result) {
      return false;
    }
    return parsed.data.result.status === 'active';
  }

  private httpErrorCode(status: number): ProviderErrorCode {
    if (status === 429) return 'RATE_LIMITED';
    if (status >= 500 && status <= 599) return 'UPSTREAM_UNAVAILABLE';
    if (status === 400) return 'INVALID_REQUEST';
    if (status === 404) return 'RESOURCE_NOT_FOUND';
    return 'UNKNOWN_PROVIDER_ERROR';
  }
}
