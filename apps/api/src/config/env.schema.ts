import { z } from 'zod';

const CorsOriginsSchema = z
  .string()
  .trim()
  .default('http://localhost:5173')
  .transform((value, context) => {
    const origins = value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (origins.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'CORS_ORIGINS must include at least one explicit origin',
      });
      return z.NEVER;
    }

    for (const origin of origins) {
      try {
        const url = new URL(origin);
        if (
          (url.protocol !== 'http:' && url.protocol !== 'https:') ||
          url.origin !== origin ||
          url.username.length > 0 ||
          url.password.length > 0
        ) {
          throw new Error('Unsupported origin protocol');
        }
      } catch {
        context.addIssue({
          code: 'custom',
          message: 'CORS_ORIGINS entries must be valid HTTP(S) origins',
        });
        return z.NEVER;
      }
    }

    return origins;
  });

export const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().trim().min(1).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  CORS_ORIGINS: CorsOriginsSchema,
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export type AppEnvironment = z.infer<typeof EnvironmentSchema>;

export function parseEnvironment(
  environment: NodeJS.ProcessEnv,
): AppEnvironment {
  const result = EnvironmentSchema.safeParse(environment);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid API environment configuration: ${issues}`);
  }

  return result.data;
}
