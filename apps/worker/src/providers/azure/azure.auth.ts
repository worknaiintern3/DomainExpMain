import { Buffer } from 'node:buffer';

import { ProviderAdapterError } from '../provider.errors';
import {
  AZURE_LOGIN_ORIGIN,
  AZURE_MANAGEMENT_SCOPE,
  type AzureCredential,
} from './azure.constants';

/**
 * Mints an access token via Azure AD's documented OAuth2 "client
 * credentials" grant (app-only, service-to-service; no user is involved) --
 * a single form POST to `login.microsoftonline.com/{tenantId}/oauth2/v2.0
 * /token` with `scope=https://management.azure.com/.default`. Implemented
 * with plain `fetch`, no SDK: the flow is one documented HTTP request, and
 * every other provider adapter in this codebase authenticates the same way.
 */

export interface AzureAccessToken {
  readonly accessToken: string;
}

export interface AzureAuthOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly timeoutMs?: number;
}

export class AzureAuthClient {
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: AzureAuthOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async mintAccessToken(credential: AzureCredential): Promise<AzureAccessToken> {
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
      // Azure AD's token-endpoint errors (invalid tenant/client/secret,
      // AADSTS7000xxx codes, ...) are fundamentally statements about the
      // service principal's credentials, not the network.
      const errorField = (parsed as { error?: unknown }).error;
      if (typeof errorField === 'string') {
        throw new ProviderAdapterError('AUTH_INVALID');
      }
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }

    const accessToken = (parsed as { access_token?: unknown }).access_token;
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new ProviderAdapterError('UPSTREAM_BAD_RESPONSE');
    }
    return { accessToken };
  }
}
