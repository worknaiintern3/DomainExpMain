import type { AuthenticatedRequest } from '../auth/http';
import type { WorkspacePrincipal } from './workspace-context.types';

export interface WorkspaceContextRequest extends AuthenticatedRequest {
  workspacePrincipal?: WorkspacePrincipal;
}
