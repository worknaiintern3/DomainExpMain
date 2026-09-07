/**
 * Password hashes use scrypt with a 128 MiB work factor. The encoded form also
 * carries these values, while verification accepts only this reviewed profile
 * so untrusted hashes cannot request attacker-controlled resource usage.
 */
export const PASSWORD_HASH_ALGORITHM = 'scrypt';
export const PASSWORD_HASH_VERSION = 1;
export const PASSWORD_SALT_BYTES = 16;
export const PASSWORD_HASH_BYTES = 64;
export const PASSWORD_HASH_MAX_ENCODED_LENGTH = 512;

export const PASSWORD_SCRYPT_PARAMETERS = {
  N: 1 << 17,
  r: 8,
  p: 1,
  maxmem: 256 * 1024 * 1024,
} as const;

/** A generated refresh token contains 256 bits of cryptographic randomness. */
export const REFRESH_TOKEN_BYTES = 32;
export const REFRESH_TOKEN_HASH_ALGORITHM = 'sha256';
