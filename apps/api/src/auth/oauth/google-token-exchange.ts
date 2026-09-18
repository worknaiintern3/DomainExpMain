import { GoogleAuthenticationFailedError } from './google-oauth.errors';
import type { GoogleOAuthConfiguration } from './google-oauth.types';

/**
 * Server-to-server exchange of a Google authorization code for an ID token,
 * using the server-held PKCE `code_verifier` (never a caller-supplied one)
 * and the static, env-configured client id/secret/redirect URI -- never
 * request data. Google's response also carries an `access_token` and
 * possibly a `refresh_token`; both are read and discarded in the same
 * expression that extracts `id_token`, so neither this function's return
 * type nor any caller ever has a reference to them (locked decision 9: no
 * Google access/refresh token is ever persisted, logged, or returned).
 */

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1_000_000;

const GRANT_TYPE = 'authorization_code';

export interface GoogleTokenExchangeOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly timeoutMs?: number;
}

export class GoogleTokenExchangeClient {
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: GoogleTokenExchangeOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Resolves the raw, still-unverified Google ID token JWT string. The caller (google-oauth.service.ts) must run it through google-id-token-verifier.ts before trusting any claim. */
  async exchangeAuthorizationCode(
    config: GoogleOAuthConfiguration,
    code: string,
    codeVerifier: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: GRANT_TYPE,
      redirect_uri: config.redirectUri,
    }).toString();

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(GOOGLE_TOKEN_ENDPOINT, {
        body,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      throw new GoogleAuthenticationFailedError();
    } finally {
      clearTimeout(timeout);
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new GoogleAuthenticationFailedError();
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new GoogleAuthenticationFailedError();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new GoogleAuthenticationFailedError();
    }

    if (!response.ok) {
      // Google's error body (`error`, `error_description`) is never
      // surfaced -- a failed exchange is always the same generic failure.
      throw new GoogleAuthenticationFailedError();
    }

    // `access_token`/`refresh_token` are intentionally never bound to a
    // variable -- destructuring only `id_token` here is what guarantees
    // this function cannot accidentally return or log the others.
    const { id_token: idToken } = parsed as { id_token?: unknown };
    if (typeof idToken !== 'string' || idToken.length === 0) {
      throw new GoogleAuthenticationFailedError();
    }

    return idToken;
  }
}
