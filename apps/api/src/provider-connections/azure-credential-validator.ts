import { Buffer } from 'node:buffer';

import type { ProviderErrorCode } from './provider-connections.types';

/**
 * Minimal Azure credential-verification client, mirroring
 * aws-credential-validator.ts / gcp-credential-validator.ts: used only by
 * the connection create/validate/rotate flows, validating outside any DB
 * transaction and before persisting anything. Azure has no dedicated
 * "verify this service principal" endpoint, so this mints a real OAuth
 * token via the client-credentials grant (the same flow the worker's
 * `AzureAdapter` uses) and performs the smallest real read against the
 * exact Compute API surface Phase 10I sync uses -- the subscription-wide VM
 * list, page one only -- so a successful validation is a truthful statement
 * about the service principal, the subscription, and RBAC access together.
 * This is a second, independent implementation of the token-mint step (not
 * an import of apps/worker) for the same reason
 * namecheap-token-validator.ts duplicates NamecheapAdapter's credential
 * parsing.
 */

const AZURE_LOGIN_ORIGIN = 'https://login.microsoftonline.com';
const AZURE_MANAGEMENT_ORIGIN = 'https://management.azure.com';
const AZURE_MANAGEMENT_SCOPE = 'https://management.azure.com/.default';
const AZURE_COMPUTE_API_VERSION = '2024-07-01';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_CREDENTIAL_LENGTH = 4_096;
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export class AzureTokenValidationError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode) {
    super('Azure credential validation failed');
    this.name = 'AzureTokenValidationError';
    this.code = code;
  }
}

interface AzureCredential {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly subscriptionId: string;
  readonly tenantId: string;
}

function parseCredential(raw: string): AzureCredential {
  if (typeof raw !== 'string' || raw.trim().length === 0 || raw.length > MAX_CREDENTIAL_LENGTH) {
    throw new AzureTokenValidationError('INVALID_REQUEST');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AzureTokenValidationError('INVALID_REQUEST');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new AzureTokenValidationError('INVALID_REQUEST');
  }
  const { tenantId, clientId, clientSecret, subscriptionId } = parsed as Record<string, unknown>;
  if (typeof tenantId !== 'string' || !GUID_PATTERN.test(tenantId)) {
    throw new AzureTokenValidationError('INVALID_REQUEST');
  }
  if (typeof clientId !== 'string' || !GUID_PATTERN.test(clientId)) {
    throw new AzureTokenValidationError('INVALID_REQUEST');
  }
  if (typeof subscriptionId !== 'string' || !GUID_PATTERN.test(subscriptionId)) {
    throw new AzureTokenValidationError('INVALID_REQUEST');
  }
  if (typeof clientSecret !== 'string' || clientSecret.trim().length === 0 || clientSecret.length > 512) {
    throw new AzureTokenValidationError('INVALID_REQUEST');
  }
  return { clientId, clientSecret, subscriptionId, tenantId };
}

export interface AzureCredentialValidatorOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly timeoutMs?: number;
}

export class AzureCredentialValidator {
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: AzureCredentialValidatorOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Resolves true when the service principal can list VMs in the named subscription, false only for a truthful "invalid service principal" result, and throws for every other transport/upstream/access failure. */
  async isTokenActive(token: string): Promise<boolean> {
    const credential = parseCredential(token);
    let accessToken: string;
    try {
      accessToken = await this.mintAccessToken(credential);
    } catch (error) {
      if (error instanceof AzureTokenValidationError && error.code === 'AUTH_INVALID') {
        return false;
      }
      throw error;
    }

    const url = new URL(
      `/subscriptions/${credential.subscriptionId}/providers/Microsoft.Compute/virtualMachines`,
      AZURE_MANAGEMENT_ORIGIN,
    );
    url.searchParams.set('api-version', AZURE_COMPUTE_API_VERSION);

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
      throw new AzureTokenValidationError(
        controller.signal.aborted ? 'NETWORK_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      );
    } finally {
      clearTimeout(timeout);
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new AzureTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new AzureTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new AzureTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    if (!response.ok) {
      let code: string | undefined;
      try {
        const parsed = JSON.parse(text) as { error?: { code?: unknown } };
        code = typeof parsed.error?.code === 'string' ? parsed.error.code : undefined;
      } catch {
        // fall through to HTTP-status-only classification below
      }
      if (response.status === 401 || (code !== undefined && code.includes('InvalidAuthenticationToken'))) {
        throw new AzureTokenValidationError('AUTH_INVALID');
      }
      if (response.status === 403 || code === 'AuthorizationFailed') {
        throw new AzureTokenValidationError('PERMISSION_DENIED');
      }
      if (response.status === 404 || code === 'SubscriptionNotFound') {
        throw new AzureTokenValidationError('RESOURCE_NOT_FOUND');
      }
      if (response.status === 429) {
        throw new AzureTokenValidationError('RATE_LIMITED');
      }
      if (response.status >= 500) {
        throw new AzureTokenValidationError('UPSTREAM_UNAVAILABLE');
      }
      throw new AzureTokenValidationError('UNKNOWN_PROVIDER_ERROR');
    }
    return true;
  }

  private async mintAccessToken(credential: AzureCredential): Promise<string> {
    const url = new URL(`/${credential.tenantId}/oauth2/v2.0/token`, AZURE_LOGIN_ORIGIN);
    const body = new URLSearchParams({
      client_id: credential.clientId,
      client_secret: credential.clientSecret,
      grant_type: 'client_credentials',
      scope: AZURE_MANAGEMENT_SCOPE,
    }).toString();

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        body,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      throw new AzureTokenValidationError(
        controller.signal.aborted ? 'NETWORK_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      );
    } finally {
      clearTimeout(timeout);
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new AzureTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new AzureTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    // Status-based classification runs before the JSON parse attempt: a
    // throttled/5xx response is not guaranteed to have any body at all, and
    // that must still classify by status rather than as a parse failure.
    if (!response.ok) {
      if (response.status === 429) throw new AzureTokenValidationError('RATE_LIMITED');
      if (response.status >= 500) throw new AzureTokenValidationError('UPSTREAM_UNAVAILABLE');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new AzureTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }

    if (!response.ok) {
      const errorField = (parsed as { error?: unknown }).error;
      if (typeof errorField === 'string') {
        throw new AzureTokenValidationError('AUTH_INVALID');
      }
      throw new AzureTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    const accessToken = (parsed as { access_token?: unknown }).access_token;
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new AzureTokenValidationError('UPSTREAM_BAD_RESPONSE');
    }
    return accessToken;
  }
}
