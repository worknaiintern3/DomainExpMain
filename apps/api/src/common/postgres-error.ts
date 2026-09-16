/**
 * Extracts a PostgreSQL error code (e.g. '23505') from a thrown error,
 * unwrapping driver/ORM `cause` chains. Cycle-protected: a `cause` chain that
 * loops back on itself returns undefined instead of hanging.
 */
export function getPostgreSqlErrorCode(error: unknown): string | undefined {
  const visited = new Set<object>();
  let current = error;
  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) {
      return undefined;
    }
    visited.add(current);
    const shape = current as { cause?: unknown; code?: unknown };
    if (typeof shape.code === 'string') {
      return shape.code;
    }
    current = shape.cause;
  }
  return undefined;
}
