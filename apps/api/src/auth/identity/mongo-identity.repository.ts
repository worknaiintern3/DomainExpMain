import { IdentityPersistenceError } from './identity.errors';
import type { AuthenticatedUser, IdentityStore } from './identity.types';
import type { DatabaseService } from '../../database/database.service';

export class MongoIdentityRepository implements IdentityStore {
  constructor(private readonly database: DatabaseService) {}

  async findUserById(userId: string): Promise<AuthenticatedUser | undefined> {
    const collections = this.database.collections;
    if (!collections) {
      throw new IdentityPersistenceError();
    }

    try {
      const user = await collections.users.findOne({ id: userId });
      if (!user) {
        return undefined;
      }

      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName ?? null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch {
      throw new IdentityPersistenceError();
    }
  }
}
