import type { Database } from '@domainpulse/database';

export interface AuthenticatedUser {
  readonly createdAt: Date;
  readonly displayName: string | null;
  readonly email: string;
  readonly id: string;
  readonly updatedAt: Date;
}

export interface IdentityStore {
  findUserById(userId: string): Promise<AuthenticatedUser | undefined>;
}

export interface IdentityDatabaseHost {
  readonly database: Database;
}
