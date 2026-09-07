import type { DatabaseTransactionOperation } from '@domainpulse/database';

export interface RegisterUserInput {
  readonly displayName?: string;
  readonly email: string;
  readonly password: string;
}

export interface RegisteredUser {
  readonly createdAt: Date;
  readonly displayName: string | null;
  readonly email: string;
  readonly id: string;
  readonly normalizedEmail: string;
  readonly updatedAt: Date;
}

export interface PersistRegistrationInput {
  readonly displayName?: string;
  readonly email: string;
  readonly normalizedEmail: string;
  readonly passwordHash: string;
}

export interface RegistrationStore {
  createRegistration(input: PersistRegistrationInput): Promise<RegisteredUser>;
}

export interface RegistrationTransactionHost {
  transaction<T>(operation: DatabaseTransactionOperation<T>): Promise<T>;
}

export type RegistrationPasswordHasher = (password: string) => Promise<string>;
