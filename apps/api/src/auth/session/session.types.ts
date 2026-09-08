import type {
  Database,
  DatabaseTransactionOperation,
} from '@domainpulse/database';

import type {
  AccessTokenSubject,
  IssuedAccessToken,
} from '../access-token';

export interface RotateRefreshCredentialInput {
  readonly currentRefreshTokenHash: string;
  readonly nextExpiresAt: Date;
  readonly nextRefreshTokenHash: string;
  readonly rotatedAt: Date;
}

export interface RotatedSession extends AccessTokenSubject {
  readonly expiresAt: Date;
}

export type RefreshRotationPersistenceResult =
  | { readonly kind: 'invalid' }
  | { readonly kind: 'replayed' }
  | { readonly kind: 'rotated'; readonly session: RotatedSession };

export interface SessionStore {
  revokeSession(
    userId: string,
    sessionId: string,
    revokedAt: Date,
  ): Promise<void>;
  rotateRefreshCredential(
    input: RotateRefreshCredentialInput,
  ): Promise<RefreshRotationPersistenceResult>;
}

export interface SessionDatabaseHost {
  readonly database: Database;
  transaction<T>(operation: DatabaseTransactionOperation<T>): Promise<T>;
}

export interface AccessTokenIssuer {
  issue(subject: AccessTokenSubject): IssuedAccessToken;
}

export interface RefreshTokenPair {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshToken: string;
  readonly session: {
    readonly expiresAt: Date;
    readonly id: string;
  };
}

export type SessionRefreshTokenGenerator = () => string;
export type SessionRefreshTokenHasher = (refreshToken: string) => string;
