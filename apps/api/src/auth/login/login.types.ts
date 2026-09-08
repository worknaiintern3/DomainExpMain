export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface LoginUser {
  readonly createdAt: Date;
  readonly displayName: string | null;
  readonly email: string;
  readonly id: string;
  readonly normalizedEmail: string;
  readonly updatedAt: Date;
}

export interface LoginSession {
  readonly expiresAt: Date;
  readonly id: string;
}

export interface LoginResult {
  readonly refreshToken: string;
  readonly session: LoginSession;
  readonly user: LoginUser;
}

export interface StoredLoginCredential {
  readonly passwordHash: string;
  readonly user: LoginUser;
}

export interface PersistLoginSessionInput {
  readonly expiresAt: Date;
  readonly refreshTokenHash: string;
  readonly userId: string;
}

export interface LoginStore {
  findCredentialByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<StoredLoginCredential | undefined>;
  createSession(input: PersistLoginSessionInput): Promise<LoginSession>;
}

export type LoginPasswordVerifier = (
  password: string,
  storedHash: string,
) => Promise<boolean>;

export type LoginRefreshTokenGenerator = () => string;

export type LoginRefreshTokenHasher = (refreshToken: string) => string;
