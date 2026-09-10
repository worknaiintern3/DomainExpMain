import type {
  CreateInventoryRelationshipRequest,
  InventoryRelationshipListQuery,
  UpdateInventoryRelationshipRequest,
} from '@domainpulse/contracts';
import type {
  DatabaseTransactionOperation,
  StoredInventoryRelationship,
} from '@domainpulse/database';

import type { WorkspacePrincipal } from '../../workspace-context';
import type { InventoryCursorPosition } from '../inventory.types';

export interface RelationshipDatabaseHost {
  withWorkspaceContext<T>(
    workspaceId: string,
    operation: DatabaseTransactionOperation<T>,
  ): Promise<T>;
}

export interface InventoryRelationshipStoreListInput
  extends Omit<InventoryRelationshipListQuery, 'cursor'> {
  readonly cursor?: InventoryCursorPosition | undefined;
}

export interface InventoryRelationshipStorePage {
  readonly items: readonly StoredInventoryRelationship[];
  readonly nextCursor: InventoryCursorPosition | null;
}

export interface InventoryRelationshipStore {
  create(
    workspaceId: string,
    input: CreateInventoryRelationshipRequest,
  ): Promise<StoredInventoryRelationship>;
  findById(
    workspaceId: string,
    relationshipId: string,
  ): Promise<StoredInventoryRelationship | null>;
  list(
    workspaceId: string,
    input: InventoryRelationshipStoreListInput,
  ): Promise<InventoryRelationshipStorePage>;
  update(
    workspaceId: string,
    relationshipId: string,
    input: UpdateInventoryRelationshipRequest,
  ): Promise<StoredInventoryRelationship | null>;
  archive(workspaceId: string, relationshipId: string): Promise<boolean>;
}

export interface InventoryRelationshipServicePage {
  readonly items: readonly StoredInventoryRelationship[];
  readonly nextCursor: string | null;
}

export interface InventoryRelationshipApplicationService {
  create(
    principal: WorkspacePrincipal,
    input: CreateInventoryRelationshipRequest,
  ): Promise<StoredInventoryRelationship>;
  get(
    principal: WorkspacePrincipal,
    relationshipId: string,
  ): Promise<StoredInventoryRelationship>;
  list(
    principal: WorkspacePrincipal,
    input: InventoryRelationshipListQuery,
  ): Promise<InventoryRelationshipServicePage>;
  update(
    principal: WorkspacePrincipal,
    relationshipId: string,
    input: UpdateInventoryRelationshipRequest,
  ): Promise<StoredInventoryRelationship>;
  archive(
    principal: WorkspacePrincipal,
    relationshipId: string,
  ): Promise<void>;
}
