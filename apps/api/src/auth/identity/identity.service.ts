import { AuthenticatedIdentityNotFoundError } from './identity.errors';
import type { AuthenticatedUser, IdentityStore } from './identity.types';

export class IdentityService {
  constructor(private readonly identityStore: IdentityStore) {}

  async getAuthenticatedUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.identityStore.findUserById(userId);
    if (!user) {
      throw new AuthenticatedIdentityNotFoundError();
    }

    return user;
  }
}
