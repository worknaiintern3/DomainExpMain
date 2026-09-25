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
const HOSTINGER_VPS_PATH = '/api/vps/v1/virtual-machines';
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 4_000_000;
const MAX_TOKEN_LENGTH = 4_096;

const domainEntrySchema = z.object({
  domain: z.string().min(1).max(253),
}).passthrough();

const domainListSchema = z.union([
  z.array(domainEntrySchema),
  z.object({ data: z.array(domainEntrySchema) }).transform((val) => val.data),
  z.object({ domains: z.array(domainEntrySchema) }).transform((val) => val.domains),
]);

const vpsEntrySchema = z.object({
  id: z.union([z.string(), z.number()]),
}).passthrough();

const vpsListSchema = z.union([
  z.array(vpsEntrySchema),
  z.object({ data: z.array(vpsEntrySchema) }).transform((val) => val.data),
]);

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

  /** Resolves true when the token can read the domain portfolio or VPS virtual machines, false only for a truthful 401, and throws for every other transport/upstream failure. */
  async isTokenActive(token: string): Promise<boolean> {
    if (
      typeof token !== 'string'
      || token.trim().length === 0
      || token.length > MAX_TOKEN_LENGTH
    ) {
      throw new HostingerTokenValidationError('INVALID_REQUEST');
    }

    const domainsResult = await this.tryCheckEndpoint(
      token,
      HOSTINGER_DOMAINS_PORTFOLIO_PATH,
      domainListSchema,
    );

    if (domainsResult.status === 'VALID') {
      return true;
    }
    if (domainsResult.status === 'UNAUTHORIZED') {
      return false;
    }

    // If the domain portfolio check was rejected as forbidden (e.g. VPS-only token)
    // or failed schema/resource-not-found, attempt verification via the VPS endpoint.
    if (
      domainsResult.status === 'FORBIDDEN'
      || domainsResult.status === 'BAD_RESPONSE'
      || domainsResult.status === 'NOT_FOUND'
    ) {
      const vpsResult = await this.tryCheckEndpoint(
        token,
        HOSTINGER_VPS_PATH,
        vpsListSchema,
      );

      if (vpsResult.status === 'VALID') {
        return true;
      }
      if (vpsResult.status === 'UNAUTHORIZED') {
        return false;
      }
      if (vpsResult.status === 'FORBIDDEN' && domainsResult.status === 'FORBIDDEN') {
        throw new HostingerTokenValidationError('PERMISSION_DENIED');
      }
    }

    if (domainsResult.status === 'FORBIDDEN') {
      throw new HostingerTokenValidationError('PERMISSION_DENIED');
    }
    if (domainsResult.status === 'TIMEOUT') {
      throw new HostingerTokenValidationError('NETWORK_TIMEOUT');
    }
    if (domainsResult.status === 'NETWORK_ERROR') {
      throw new HostingerTokenValidationError('UPSTREAM_UNAVAILABLE');
    }
    if (domainsResult.status === 'HTTP_ERROR') {
      throw new HostingerTokenValidationError(domainsResult.code);
    }

    throw new HostingerTokenValidationError('UPSTREAM_BAD_RESPONSE');
  }

  private async tryCheckEndpoint(
    token: string,
    pathname: string,
    schema: z.ZodTypeAny,
  ): Promise<
    | { status: 'VALID' }
    | { status: 'UNAUTHORIZED' }
    | { status: 'FORBIDDEN' }
    | { status: 'NOT_FOUND' }
    | { status: 'TIMEOUT' }
    | { status: 'NETWORK_ERROR' }
    | { code: ProviderErrorCode; status: 'HTTP_ERROR' }
    | { status: 'BAD_RESPONSE' }
  > {
    const url = new URL(pathname, HOSTINGER_API_ORIGIN);
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
      return { status: controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR' };
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 401) return { status: 'UNAUTHORIZED' };
      if (response.status === 403) return { status: 'FORBIDDEN' };
      if (response.status === 404) return { status: 'NOT_FOUND' };
      return { code: this.httpErrorCode(response.status), status: 'HTTP_ERROR' };
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      return { status: 'BAD_RESPONSE' };
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      return { status: 'BAD_RESPONSE' };
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      return { status: 'BAD_RESPONSE' };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text) as unknown;
    } catch {
      return { status: 'BAD_RESPONSE' };
    }

    const parsed = schema.safeParse(parsedJson);
    if (!parsed.success) {
      return { status: 'BAD_RESPONSE' };
    }
    return { status: 'VALID' };
  }

  private httpErrorCode(status: number): ProviderErrorCode {
    if (status === 429) return 'RATE_LIMITED';
    if (status >= 500 && status <= 599) return 'UPSTREAM_UNAVAILABLE';
    if (status === 400) return 'INVALID_REQUEST';
    if (status === 404) return 'RESOURCE_NOT_FOUND';
    return 'UNKNOWN_PROVIDER_ERROR';
  }
}
