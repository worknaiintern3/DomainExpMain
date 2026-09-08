import { z } from 'zod';

import { AccessTokenConfigurationError } from './access-token.errors';
import type { AccessTokenConfiguration } from './access-token.types';

export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 5 * 60;
export const MIN_ACCESS_TOKEN_TTL_SECONDS = 60;
export const MAX_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

const SigningSecretSchema = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => /^[A-Za-z0-9_-]+$/u.test(value), {
    message: 'must use canonical base64url encoding',
  })
  .refine((value) => {
    const decoded = Buffer.from(value, 'base64url');
    return (
      decoded.length >= 32 &&
      decoded.length <= 64 &&
      new Set(decoded).size >= 16 &&
      decoded.toString('base64url') === value
    );
  }, {
    message: 'must encode between 32 and 64 sufficiently varied random bytes',
  })
  .transform((value) => Buffer.from(value, 'base64url'));

const AccessTokenEnvironmentSchema = z.object({
  JWT_ACCESS_TOKEN_AUDIENCE: z.string().trim().min(1).max(200),
  JWT_ACCESS_TOKEN_ISSUER: z.string().trim().min(1).max(200),
  JWT_ACCESS_TOKEN_SECRET: SigningSecretSchema,
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(MIN_ACCESS_TOKEN_TTL_SECONDS)
    .max(MAX_ACCESS_TOKEN_TTL_SECONDS)
    .default(DEFAULT_ACCESS_TOKEN_TTL_SECONDS),
});

export function parseAccessTokenEnvironment(
  environment: NodeJS.ProcessEnv,
): AccessTokenConfiguration {
  const result = AccessTokenEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new AccessTokenConfigurationError(
      `Invalid access-token configuration: ${issues}`,
    );
  }

  return {
    audience: result.data.JWT_ACCESS_TOKEN_AUDIENCE,
    issuer: result.data.JWT_ACCESS_TOKEN_ISSUER,
    signingKey: result.data.JWT_ACCESS_TOKEN_SECRET,
    ttlSeconds: result.data.JWT_ACCESS_TOKEN_TTL_SECONDS,
  };
}
