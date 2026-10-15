import { WorkspaceContextPersistenceError } from './workspace-context.errors';
import type {
  ResolvedWorkspaceMembership,
  WorkspaceContextStore,
} from './workspace-context.types';
import type { DatabaseService } from '../database/database.service';

export class MongoWorkspaceContextRepository implements WorkspaceContextStore {
  constructor(private readonly database: DatabaseService) {}

  async findPersonalMembership(
    userId: string,
  ): Promise<ResolvedWorkspaceMembership | undefined> {
    const collections = this.database.collections;
    if (!collections) {
      throw new WorkspaceContextPersistenceError();
    }

    try {
      const user = await collections.users.findOne({ id: userId });
      if (!user) {
        return undefined;
      }

      const membership = await collections.workspaceMembers.findOne({
        userId,
        workspaceId: user.personalWorkspaceId,
      });

      if (!membership) {
        return undefined;
      }

      return {
        membershipId: membership.id,
        role: membership.role,
        workspaceId: membership.workspaceId,
      };
    } catch {
      throw new WorkspaceContextPersistenceError();
    }
  }

  async findExplicitMembership(
    userId: string,
    workspaceId: string,
  ): Promise<ResolvedWorkspaceMembership | undefined> {
    const collections = this.database.collections;
    if (!collections) {
      throw new WorkspaceContextPersistenceError();
    }

    try {
      const membership = await collections.workspaceMembers.findOne({
        userId,
        workspaceId,
      });

      if (!membership) {
        return undefined;
      }

      return {
        membershipId: membership.id,
        role: membership.role,
        workspaceId: membership.workspaceId,
      };
    } catch {
      throw new WorkspaceContextPersistenceError();
    }
  }
}
