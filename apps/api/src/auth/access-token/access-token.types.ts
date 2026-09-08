export interface AccessTokenConfiguration {
  readonly audience: string;
  readonly issuer: string;
  readonly signingKey: Buffer;
  readonly ttlSeconds: number;
}

export interface AccessTokenSubject {
  readonly sessionId: string;
  readonly userId: string;
}

export type AuthenticatedPrincipal = AccessTokenSubject;

export interface IssuedAccessToken {
  readonly expiresAt: Date;
  readonly token: string;
}
