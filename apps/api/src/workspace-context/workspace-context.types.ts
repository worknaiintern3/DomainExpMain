import type {
  UserTransactionHost,
  WorkspaceMember,
} from '@domainpulse/database';

import type { AuthenticatedPrincipal } from '../auth/access-token';

export type WorkspaceRole = WorkspaceMember['role'];

export interface ResolvedWorkspaceMembership {
  readonly membershipId: string;
  readonly role: WorkspaceRole;
  readonly workspaceId: string;
}

export type WorkspacePrincipal = AuthenticatedPrincipal &
  ResolvedWorkspaceMembership;

export interface WorkspaceContextStore {
  readonly findExplicitMembership: (
    userId: string,
    workspaceId: string,
  ) => Promise<ResolvedWorkspaceMembership | undefined>;
  readonly findPersonalMembership: (
    userId: string,
  ) => Promise<ResolvedWorkspaceMembership | undefined>;
}

export type WorkspaceContextDatabaseHost = UserTransactionHost;
