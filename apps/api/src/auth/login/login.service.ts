import {
  generateRefreshToken,
  hashRefreshToken,
  verifyPassword,
} from '../crypto';
import { normalizeRegistrationEmail } from '../registration/email-normalization';
import { InvalidCredentialsError } from './login.errors';
import type {
  LoginInput,
  LoginPasswordVerifier,
  LoginRefreshTokenGenerator,
  LoginRefreshTokenHasher,
  LoginResult,
  LoginStore,
} from './login.types';

export const LOGIN_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Fixed precomputed dummy password hash using the exact current DomainPulse
 * scrypt profile. Not a secret: it exists only so unknown-email logins run
 * the same single scrypt verification as wrong-password logins.
 * Never generated per request, never read from the database, never persisted.
 */
export const DUMMY_PASSWORD_HASH =
  '$scrypt$v=1$N=131072,r=8,p=1,l=64$02bgkJD25ot8r28jCe-jdg$oV1_jfp8CVzTJk-eUR4kK3VxoHrvynMsPZcuJVd_Y5vRUXnohvVIwO4UI40Lry3C2wO-f4g1_LR0s2W9BfKVkw';

export class LoginService {
  constructor(
    private readonly loginStore: LoginStore,
    private readonly passwordVerifier: LoginPasswordVerifier = verifyPassword,
    private readonly refreshTokenGenerator: LoginRefreshTokenGenerator = generateRefreshToken,
    private readonly refreshTokenHasher: LoginRefreshTokenHasher = hashRefreshToken,
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

  async login(input: LoginInput): Promise<LoginResult> {
    const normalizedEmail = normalizeRegistrationEmail(input.email);
    const credential =
      await this.loginStore.findCredentialByNormalizedEmail(normalizedEmail);

    const hashToVerify = credential?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = await this.passwordVerifier(
      input.password,
      hashToVerify,
    );

    if (!credential || !passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const refreshToken = this.refreshTokenGenerator();
    const refreshTokenHash = this.refreshTokenHasher(refreshToken);
    const expiresAt = new Date(this.now() + this.sessionTtlMs);

    const session = await this.loginStore.createSession({
      expiresAt,
      refreshTokenHash,
      userId: credential.user.id,
    });

    return {
      refreshToken,
      session,
      user: credential.user,
    };
  }
}
