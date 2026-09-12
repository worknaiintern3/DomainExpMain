import { describe, expect, it } from 'vitest';

import {
  canRetry,
  retryDelayMs,
  retryIdempotencyKey,
} from '../src/monitoring/retry-policy';

describe('monitoring retry policy', () => {
  it('uses the reviewed 5/20/60 minute retry schedule', () => {
    expect(retryDelayMs(2)).toBe(5 * 60_000);
    expect(retryDelayMs(3)).toBe(20 * 60_000);
    expect(retryDelayMs(4)).toBe(60 * 60_000);
    expect(retryDelayMs(1)).toBeUndefined();
    expect(retryDelayMs(5)).toBeUndefined();
  });

  it('caps retries and never retries non-transient failures', () => {
    expect(canRetry(1, 3, true)).toBe(true);
    expect(canRetry(3, 3, true)).toBe(true);
    expect(canRetry(4, 3, true)).toBe(false);
    expect(canRetry(1, 3, false)).toBe(false);
    expect(canRetry(1, 0, true)).toBe(false);
  });

  it('derives stable deduplicated retry keys from the root run', () => {
    expect(retryIdempotencyKey('scheduled:100', 2)).toBe(
      'scheduled:100:retry:2',
    );
    expect(retryIdempotencyKey('scheduled:100:retry:2', 3)).toBe(
      'scheduled:100:retry:3',
    );
  });
});
