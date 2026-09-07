import { createHash, randomBytes } from 'node:crypto';

import {
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_HASH_ALGORITHM,
} from './auth-crypto.constants';

export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

/**
 * Opaque refresh tokens already have high entropy, so a deterministic SHA-256
 * digest is suitable for lookup while the raw token remains caller-only.
 */
export function hashRefreshToken(refreshToken: string): string {
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    throw new TypeError('Refresh token must be a non-empty string');
  }

  return createHash(REFRESH_TOKEN_HASH_ALGORITHM)
    .update(refreshToken, 'utf8')
    .digest('hex');
}
