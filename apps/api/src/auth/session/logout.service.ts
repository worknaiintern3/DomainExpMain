import type { AuthenticatedPrincipal } from '../access-token';
import type { SessionStore } from './session.types';

export class LogoutService {
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly now: () => number = Date.now,
  ) {}

  logout(principal: AuthenticatedPrincipal): Promise<void> {
    return this.sessionStore.revokeSession(
      principal.userId,
      principal.sessionId,
      new Date(this.now()),
    );
  }
}
