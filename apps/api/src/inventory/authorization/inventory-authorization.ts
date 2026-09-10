import type { WorkspacePrincipal } from '../../workspace-context';
import { InventoryWriteForbiddenError } from '../inventory.errors';

export function requireInventoryWriteAccess(
  principal: WorkspacePrincipal,
): void {
  if (principal.role === 'member') {
    throw new InventoryWriteForbiddenError();
  }
}
