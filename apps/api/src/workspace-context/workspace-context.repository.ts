import { users, workspaceMembers } from '@domainpulse/database';
import { and, eq } from 'drizzle-orm';

import { WorkspaceContextPersistenceError } from './workspace-context.errors';
import type {
  ResolvedWorkspaceMembership,
  WorkspaceContextDatabaseHost,
  WorkspaceContextStore,
} from './workspace-context.types';

const membershipSelection = {
  membershipId: workspaceMembers.id,
  role: workspaceMembers.role,
  workspaceId: workspaceMembers.workspaceId,
};

export class PostgresWorkspaceContextRepository
  implements WorkspaceContextStore
{
  constructor(private readonly host: WorkspaceContextDatabaseHost) {}

  async findPersonalMembership(
    userId: string,
  ): Promise<ResolvedWorkspaceMembership | undefined> {
    try {
      return await this.host.withUserContext(
        userId,
        async (transaction) => {
          const [user] = await transaction
            .select({ personalWorkspaceId: users.personalWorkspaceId })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

          if (!user) {
            return undefined;
          }

          const [membership] = await transaction
            .select(membershipSelection)
            .from(users)
            .innerJoin(
              workspaceMembers,
              and(
                eq(workspaceMembers.userId, users.id),
                eq(workspaceMembers.workspaceId, users.personalWorkspaceId),
              ),
            )
            .where(eq(users.id, userId))
            .limit(1);

          return membership;
        },
      );
    } catch {
      throw new WorkspaceContextPersistenceError();
    }
  }

  async findExplicitMembership(
    userId: string,
    workspaceId: string,
  ): Promise<ResolvedWorkspaceMembership | undefined> {
    try {
      return await this.host.withUserContext(
        userId,
        async (transaction) => {
          const [membership] = await transaction
            .select(membershipSelection)
            .from(workspaceMembers)
            .where(
              and(
                eq(workspaceMembers.userId, userId),
                eq(workspaceMembers.workspaceId, workspaceId),
              ),
            )
            .limit(1);

          return membership;
        },
      );
    } catch {
      throw new WorkspaceContextPersistenceError();
    }
  }
}
