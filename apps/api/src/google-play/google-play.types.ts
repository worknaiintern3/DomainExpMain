export interface GooglePlayOAuthTokens {
  readonly accessToken: string;
  readonly refreshToken?: string | undefined;
  readonly expiresIn: number;
  readonly scope: string;
  readonly idToken?: string | undefined;
}

export interface GoogleUserInfo {
  readonly sub: string;
  readonly email: string;
  readonly emailVerified?: boolean | undefined;
}

export type GooglePlayAccessState =
  | 'ACCESS_STATE_UNSPECIFIED'
  | 'INVITED'
  | 'INVITATION_EXPIRED'
  | 'ACCESS_GRANTED';

export interface GooglePlayGrant {
  readonly name?: string | undefined;
  readonly packageName: string;
  readonly appLevelPermissions?: readonly string[] | undefined;
}

export interface GooglePlayUserResource {
  readonly name: string;
  readonly email: string;
  readonly accessState?: GooglePlayAccessState | undefined;
  readonly developerAccountPermissions?: readonly string[] | undefined;
  readonly grants?: readonly GooglePlayGrant[] | undefined;
  readonly partial?: boolean | undefined;
}

export interface GooglePlayAppListing {
  readonly language?: string | undefined;
  readonly title?: string | undefined;
  readonly fullDescription?: string | undefined;
  readonly shortDescription?: string | undefined;
}

export interface GooglePlayAppSummary {
  readonly packageName: string;
  readonly appName: string;
  readonly playStoreUrl: string;
}

export interface GooglePlayConnectionEntity {
  readonly id: string;
  readonly userId: string;
  readonly googleAccountId: string;
  readonly googleAccountEmail: string;
  readonly developerAccountId: string | null;
  readonly encryptedAccessToken: string;
  readonly encryptedRefreshToken: string | null;
  readonly tokenExpiresAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface GooglePlayOAuthStateEntity {
  readonly id: string;
  readonly userId: string;
  readonly state: string;
  readonly codeVerifier: string;
  readonly developerAccountId: string | null;
  readonly redirectUri: string | null;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}
