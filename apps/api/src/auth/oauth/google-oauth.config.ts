import { z } from 'zod';

import { GoogleOAuthConfigurationError } from './google-oauth.errors';
import type { GoogleOAuthConfiguration } from './google-oauth.types';

export const DEFAULT_OAUTH_TRANSACTION_TTL_SECONDS = 600;
export const MIN_OAUTH_TRANSACTION_TTL_SECONDS = 60;
export const MAX_OAUTH_TRANSACTION_TTL_SECONDS = 1_800;

/**
 * Mirrors CorsOriginsSchema's redirect-URI shape validation (env.schema.ts):
 * a real absolute URL, http(s) only, no embedded userinfo. Unlike CORS
 * origins, exactly one value is required (Google redirects to exactly one
 * registered URI per request), and `http:` is accepted only for a
 * `localhost`/`127.0.0.1` host -- matching Google's own documented
 * development allowance -- never for any other host, so a misconfigured
 * production deployment cannot silently downgrade to plaintext.
 */
const RedirectUriSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .transform((value, context) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'GOOGLE_OAUTH_REDIRECT_URI must be an absolute URL',
      });
      return z.NEVER;
    }
    const isLocalDevelopmentHost =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const hasAllowedProtocol =
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && isLocalDevelopmentHost);

    if (
      !hasAllowedProtocol ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'GOOGLE_OAUTH_REDIRECT_URI must be https, or http on localhost/127.0.0.1 only, with no embedded credentials',
      });
      return z.NEVER;
    }

    return value;
  });

const GoogleOAuthEnvironmentSchema = z.object({
  GOOGLE_OAUTH_CLIENT_ID: z.string().trim().min(1).max(256),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).max(256),
  GOOGLE_OAUTH_REDIRECT_URI: RedirectUriSchema,
  GOOGLE_OAUTH_TRANSACTION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(MIN_OAUTH_TRANSACTION_TTL_SECONDS)
    .max(MAX_OAUTH_TRANSACTION_TTL_SECONDS)
    .default(DEFAULT_OAUTH_TRANSACTION_TTL_SECONDS),
});

export function parseGoogleOAuthEnvironment(
  environment: NodeJS.ProcessEnv,
): GoogleOAuthConfiguration {
  const result = GoogleOAuthEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new GoogleOAuthConfigurationError(
      `Invalid Google OAuth configuration: ${issues}`,
    );
  }

  return {
    clientId: result.data.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: result.data.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: result.data.GOOGLE_OAUTH_REDIRECT_URI,
    transactionTtlSeconds: result.data.GOOGLE_OAUTH_TRANSACTION_TTL_SECONDS,
  };
}
