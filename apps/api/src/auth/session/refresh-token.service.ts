import { generateRefreshToken, hashRefreshToken } from '../crypto';
import { LOGIN_SESSION_TTL_MS } from '../login';
import { InvalidRefreshTokenError } from './session.errors';
import type {
  AccessTokenIssuer,
  RefreshTokenPair,
  SessionRefreshTokenGenerator,
  SessionRefreshTokenHasher,
  SessionStore,
} from './session.types';

export const MAX_REFRESH_TOKEN_INPUT_LENGTH = 512;

export class RefreshTokenService {
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly accessTokenIssuer: AccessTokenIssuer,
    private readonly refreshTokenGenerator: SessionRefreshTokenGenerator = generateRefreshToken,
    private readonly refreshTokenHasher: SessionRefreshTokenHasher = hashRefreshToken,
    private readonly sessionTtlMs: number = LOGIN_SESSION_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {
    if (
      !Number.isFinite(this.sessionTtlMs) ||
      this.sessionTtlMs <= 0 ||
      this.sessionTtlMs > LOGIN_SESSION_TTL_MS
    ) {
      throw new RangeError(
        'Session TTL must be finite, positive, and at most 30 days',
      );
    }
  }

  async refresh(currentRefreshToken: string): Promise<RefreshTokenPair> {
    if (
      typeof currentRefreshToken !== 'string' ||
      currentRefreshToken.length === 0 ||
      currentRefreshToken.length > MAX_REFRESH_TOKEN_INPUT_LENGTH
    ) {
      throw new InvalidRefreshTokenError();
    }

    const nextRefreshToken = this.refreshTokenGenerator();
    const currentRefreshTokenHash = this.refreshTokenHasher(currentRefreshToken);
    const nextRefreshTokenHash = this.refreshTokenHasher(nextRefreshToken);
    const rotatedAt = new Date(this.now());
    const rotation = await this.sessionStore.rotateRefreshCredential({
      currentRefreshTokenHash,
      nextExpiresAt: new Date(rotatedAt.getTime() + this.sessionTtlMs),
      nextRefreshTokenHash,
      rotatedAt,
    });

    if (rotation.kind !== 'rotated') {
      throw new InvalidRefreshTokenError();
    }

    const accessToken = this.accessTokenIssuer.issue(rotation.session);

    return {
      accessToken: accessToken.token,
      accessTokenExpiresAt: accessToken.expiresAt,
      refreshToken: nextRefreshToken,
      session: {
        expiresAt: rotation.session.expiresAt,
        id: rotation.session.sessionId,
      },
    };
  }
}
