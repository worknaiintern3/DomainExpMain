import { describe, expect, it } from 'vitest';

import {
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  verifyPassword,
} from '../src/auth/crypto';

const TEST_PASSWORD = 'unit-test-password-not-used-by-any-account';

describe('authentication crypto primitives', () => {
  it('encodes a password hash without retaining the plaintext', async () => {
    const storedHash = await hashPassword(TEST_PASSWORD);

    expect(storedHash).not.toBe(TEST_PASSWORD);
    expect(storedHash).not.toContain(TEST_PASSWORD);
    expect(storedHash).toMatch(/^\$scrypt\$v=1\$/u);
  });

  it('uses a unique salt for each password hash', async () => {
    const firstHash = await hashPassword(TEST_PASSWORD);
    const secondHash = await hashPassword(TEST_PASSWORD);

    expect(firstHash).not.toBe(secondHash);
  });

  it('verifies the correct password', async () => {
    const storedHash = await hashPassword(TEST_PASSWORD);

    await expect(verifyPassword(TEST_PASSWORD, storedHash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const storedHash = await hashPassword(TEST_PASSWORD);

    await expect(
      verifyPassword('different-unit-test-password', storedHash),
    ).resolves.toBe(false);
  });

  it.each([
    '',
    TEST_PASSWORD,
    '$unknown$v=1$N=131072,r=8,p=1,l=64$invalid$invalid',
    '$scrypt$v=2$N=131072,r=8,p=1,l=64$invalid$invalid',
    '$scrypt$v=1$N=999999999,r=8,p=1,l=64$invalid$invalid',
    '$scrypt$v=1$N=131072,r=8,p=1,l=64$invalid$invalid',
  ])('fails safely for a malformed stored hash', async (storedHash) => {
    await expect(verifyPassword(TEST_PASSWORD, storedHash)).resolves.toBe(false);
  });

  it('generates non-repeating refresh tokens with at least 256 bits', () => {
    const tokens = Array.from({ length: 64 }, () => generateRefreshToken());

    expect(new Set(tokens)).toHaveLength(tokens.length);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/u);
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    }
  });

  it('hashes the same refresh token deterministically', () => {
    const refreshToken = generateRefreshToken();
    const firstHash = hashRefreshToken(refreshToken);

    expect(firstHash).toBe(hashRefreshToken(refreshToken));
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(firstHash).not.toContain(refreshToken);
  });

  it('produces different hashes for different refresh tokens', () => {
    expect(hashRefreshToken(generateRefreshToken())).not.toBe(
      hashRefreshToken(generateRefreshToken()),
    );
  });
});
