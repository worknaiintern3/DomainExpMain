import type { AuthenticatedPrincipal } from '../auth/access-token';
import { WorkspaceAccessDeniedError } from './workspace-context.errors';
import type {
  WorkspaceContextStore,
  WorkspacePrincipal,
} from './workspace-context.types';

export class WorkspaceContextService {
  constructor(private readonly store: WorkspaceContextStore) {}

  async resolve(
    principal: AuthenticatedPrincipal,
    explicitWorkspaceId?: string,
  ): Promise<WorkspacePrincipal> {
    const membership =
      explicitWorkspaceId === undefined
        ? await this.store.findPersonalMembership(principal.userId)
        : await this.store.findExplicitMembership(
            principal.userId,
            explicitWorkspaceId,
          );

    if (!membership) {
      throw new WorkspaceAccessDeniedError();
    }

    return {
      ...principal,
      ...membership,
    };
  }
}
