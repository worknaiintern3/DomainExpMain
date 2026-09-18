import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

import type { ProviderErrorCode } from './provider-connections.types';

/**
 * Minimal Namecheap credential-verification client, mirroring
 * cloudflare-token-validator.ts / godaddy-token-validator.ts: used only by
 * the connection create/validate/rotate flows, validating outside any DB
 * transaction and before persisting anything. Namecheap has no dedicated
 * verify endpoint, so this performs the smallest real read
 * (`namecheap.domains.getList` with PageSize=10, the API's documented
 * minimum) -- the same call the worker's `NamecheapAdapter.validateToken`
 * makes -- without importing apps/worker. See
 * apps/worker/src/providers/namecheap/namecheap.constants.ts for why the
 * credential is a JSON-encoded {apiUser, apiKey, userName, clientIp} object:
 * Namecheap requires all four on every call, unlike every other provider's
 * single-secret credential.
 */

const NAMECHEAP_API_ORIGIN = 'https://api.namecheap.com';
const NAMECHEAP_API_PATH = '/xml.response';
const NAMECHEAP_GET_LIST_COMMAND = 'namecheap.domains.getList';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_CREDENTIAL_LENGTH = 4_096;
const MIN_PAGE_SIZE = 10;

const IPV4_PATTERN = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/u;

const xmlParser = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  parseAttributeValue: false,
  trimValues: true,
});

const errorEntrySchema = z.object({
  '#text': z.string().optional(),
  '@_Number': z.union([z.string(), z.number()]).optional(),
});

export class NamecheapTokenValidationError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode) {
    super('Namecheap credential validation failed');
    this.name = 'NamecheapTokenValidationError';
    this.code = code;
  }
}

interface NamecheapCredential {
  readonly apiKey: string;
  readonly apiUser: string;
  readonly clientIp: string;
  readonly userName: string;
}

function parseCredential(raw: string): NamecheapCredential {
  if (typeof raw !== 'string' || raw.trim().length === 0 || raw.length > MAX_CREDENTIAL_LENGTH) {
    throw new NamecheapTokenValidationError('INVALID_REQUEST');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new NamecheapTokenValidationError('INVALID_REQUEST');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new NamecheapTokenValidationError('INVALID_REQUEST');
  }
  const { apiKey, apiUser, clientIp, userName } = parsed as Record<string, unknown>;
  for (const value of [apiKey, apiUser, clientIp, userName]) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new NamecheapTokenValidationError('INVALID_REQUEST');
    }
  }
  if (typeof clientIp !== 'string' || !IPV4_PATTERN.test(clientIp)) {
    throw new NamecheapTokenValidationError('INVALID_REQUEST');
  }
  return {
    apiKey: apiKey as string,
    apiUser: apiUser as string,
    clientIp,
    userName: userName as string,
  };
}

function asArray<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value as readonly T[];
  return [value as T];
}

/**
 * Mirrors NamecheapAdapter's numeric-code-first classification: `Number` is
 * Namecheap's own stable, structured error code and is authoritative where
 * documented/verified -- notably 1011105 ("Parameter ClientIP is invalid")
 * is genuinely a PERMISSION_DENIED (client IP not authorized/whitelisted)
 * failure, not INVALID_REQUEST, despite its message text. Message-substring
 * matching is only a fallback for codes with no known mapping.
 */
const NAMECHEAP_NUMERIC_ERROR_CODES: Readonly<Record<string, ProviderErrorCode>> = {
  '1011102': 'AUTH_INVALID',
  '1011105': 'PERMISSION_DENIED',
  '500000': 'RATE_LIMITED',
};

function classifyByNumericCode(code: string | undefined): ProviderErrorCode | null {
  if (code === undefined) return null;
  const known = NAMECHEAP_NUMERIC_ERROR_CODES[code];
  if (known) return known;
  if (/^1010\d{3}$/u.test(code)) return 'INVALID_REQUEST';
  return null;
}

function classifyErrorMessage(message: string): ProviderErrorCode {
  const text = message.toLowerCase();
  if (text.includes('not whitelisted') || text.includes('is not registered')) {
    return 'PERMISSION_DENIED';
  }
  if (text.includes('api key is invalid') || text.includes('api access has not been enabled')) {
    return 'AUTH_INVALID';
  }
  if (text.includes('too many requests') || text.includes('rate limit')) {
    return 'RATE_LIMITED';
  }
  if (text.includes('parameter') && (text.includes('missing') || text.includes('invalid'))) {
    return 'INVALID_REQUEST';
  }
  return 'UNKNOWN_PROVIDER_ERROR';
}

function classifyNamecheapError(number: string | undefined, message: string): ProviderErrorCode {
  return classifyByNumericCode(number) ?? classifyErrorMessage(message);
}

export interface NamecheapTokenValidatorOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly timeoutMs?: number;
}

export class NamecheapTokenValidator {
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: NamecheapTokenValidatorOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** `token` carries the JSON-encoded {apiUser, apiKey, userName, clientIp} credential. Resolves true when the credential can list domains, false only for a truthful "API key is invalid" result, and throws for every other transport/upstream/access failure (e.g. IP not whitelisted). */
  async isTokenActive(token: string): Promise<boolean> {
    const credential = parseCredential(token);

    const url = new URL(NAMECHEAP_API_PATH, NAMECHEAP_API_ORIGIN);
    url.searchParams.set('ApiUser', credential.apiUser);
    url.searchParams.set('ApiKey', credential.apiKey);
    url.searchParams.set('UserName', credential.userName);
    url.searchParams.set('ClientIp', credential.clientIp);
    url.searchParams.set('Command', NAMECHEAP_GET_LIST_COMMAND);
    url.searchParams.set('Page', '1');
    url.searchParams.set('PageSize', String(MIN_PAGE_SIZE));

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      throw new NamecheapTokenValidationError(
        controller.signal.aborted ? 'NETWORK_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new NamecheapTokenValidationError(this.httpErrorCode(response.status));
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new NamecheapTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new NamecheapTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new NamecheapTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    let parsedXml: Record<string, unknown>;
    try {
      parsedXml = xmlParser.parse(text) as Record<string, unknown>;
    } catch {
      throw new NamecheapTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    const root = parsedXml.ApiResponse as Record<string, unknown> | undefined;
    const status = root?.['@_Status'];
    if (status !== 'OK' && status !== 'ERROR') {
      throw new NamecheapTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    if (status === 'ERROR') {
      const errors = asArray((root?.Errors as { Error?: unknown } | undefined)?.Error);
      const first = errorEntrySchema.safeParse(errors[0]);
      const message = first.success ? (first.data['#text'] ?? '') : '';
      const number = first.success ? String(first.data['@_Number'] ?? '') || undefined : undefined;
      const code = classifyNamecheapError(number, message);
      // "Invalid credential" is the only truthful "not active" outcome; every
      // other classification (permission/rate-limit/unknown) is a distinct
      // failure that must not be reported as an inactive credential.
      if (code === 'AUTH_INVALID') {
        return false;
      }
      throw new NamecheapTokenValidationError(code);
    }

    return true;
  }

  private httpErrorCode(status: number): ProviderErrorCode {
    if (status === 429) return 'RATE_LIMITED';
    if (status >= 500 && status <= 599) return 'UPSTREAM_UNAVAILABLE';
    if (status === 400) return 'INVALID_REQUEST';
    if (status === 401) return 'AUTH_INVALID';
    if (status === 403) return 'PERMISSION_DENIED';
    if (status === 404) return 'RESOURCE_NOT_FOUND';
    return 'UNKNOWN_PROVIDER_ERROR';
  }
}
