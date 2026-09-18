import { describe, expect, it } from 'vitest';

import {
  expectPostgresErrorCode,
  getPostgresErrorCode,
} from './postgres-error';

describe('postgres error code helper', () => {
  it('reads a top-level code from a raw pg error', () => {
    expect(getPostgresErrorCode({ code: '42501' })).toBe('42501');
  });

  it('walks wrapped Drizzle causes to the underlying PostgreSQL code', () => {
    expect(
      getPostgresErrorCode({
        message: 'Failed query',
        name: 'DrizzleQueryError',
        cause: { code: '23505' },
      }),
    ).toBe('23505');
    expect(
      getPostgresErrorCode({ cause: { cause: { code: '23514' } } }),
    ).toBe('23514');
  });

  it('returns undefined for non-error values', () => {
    expect(getPostgresErrorCode(undefined)).toBeUndefined();
    expect(getPostgresErrorCode(null)).toBeUndefined();
    expect(getPostgresErrorCode('23505')).toBeUndefined();
    expect(getPostgresErrorCode({ code: 42501 })).toBeUndefined();
    expect(getPostgresErrorCode({ cause: {} })).toBeUndefined();
  });

  it('asserts wrapped rejections without depending on message text', async () => {
    await expectPostgresErrorCode(
      () =>
        Promise.reject(
          Object.assign(new Error('Failed query'), { cause: { code: '23503' } }),
        ),
      '23503',
    );
    await expect(
      expectPostgresErrorCode(
        () => Promise.reject(new Error('connection refused')),
        '42501',
      ),
    ).rejects.toThrow();
  });
});
