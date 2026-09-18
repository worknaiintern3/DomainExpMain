import type { Database } from '@domainpulse/database';

export interface PasswordCredentialStore {
  exists(userId: string): Promise<boolean>;
  create(userId: string, passwordHash: string): Promise<void>;
}

export interface PasswordCredentialDatabaseHost {
  readonly database: Database;
}
