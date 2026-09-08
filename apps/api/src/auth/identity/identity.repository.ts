import { users } from '@domainpulse/database';
import { eq } from 'drizzle-orm';

import { IdentityPersistenceError } from './identity.errors';
import type {
  AuthenticatedUser,
  IdentityDatabaseHost,
  IdentityStore,
} from './identity.types';

export class PostgresIdentityRepository implements IdentityStore {
  constructor(private readonly host: IdentityDatabaseHost) {}

  async findUserById(userId: string): Promise<AuthenticatedUser | undefined> {
    try {
      const [user] = await this.host.database
        .select({
          createdAt: users.createdAt,
          displayName: users.displayName,
          email: users.email,
          id: users.id,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return user;
    } catch {
      throw new IdentityPersistenceError();
    }
  }
}
