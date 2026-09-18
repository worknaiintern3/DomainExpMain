import { expect } from 'vitest';

interface PostgresErrorShape {
  readonly cause?: unknown;
  readonly code?: unknown;
}

/**
 * Extracts the canonical PostgreSQL error code from a rejection that may be
 * wrapped by Drizzle (`DrizzleQueryError.cause`) or surfaced raw from `pg`.
 * Only the `code` field is inspected, never message text.
 */
export function getPostgresErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const shape = error as PostgresErrorShape;
  return typeof shape.code === 'string'
    ? shape.code
    : getPostgresErrorCode(shape.cause);
}

export async function expectPostgresErrorCode(
  operation: () => Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  const error = await operation().catch((caught: unknown) => caught);
  expect(getPostgresErrorCode(error)).toBe(expectedCode);
}
