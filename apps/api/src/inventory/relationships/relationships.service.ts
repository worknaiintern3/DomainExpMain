import type {
  CreateInventoryRelationshipRequest,
  InventoryRelationshipListQuery,
  UpdateInventoryRelationshipRequest,
} from '@domainpulse/contracts';
import type { StoredInventoryRelationship } from '@domainpulse/database';

import type { WorkspacePrincipal } from '../../workspace-context';
import { requireInventoryWriteAccess } from '../authorization/inventory-authorization';
import { InventoryRecordNotFoundError } from '../inventory.errors';
import {
  decodeInventoryCursor,
  encodeInventoryCursor,
} from '../pagination/inventory-pagination';
import type {
  InventoryRelationshipApplicationService,
  InventoryRelationshipServicePage,
  InventoryRelationshipStore,
} from './relationships.types';

export class InventoryRelationshipService
  implements InventoryRelationshipApplicationService
{
  constructor(private readonly store: InventoryRelationshipStore) {}

  async create(
    principal: WorkspacePrincipal,
    input: CreateInventoryRelationshipRequest,
  ): Promise<StoredInventoryRelationship> {
    requireInventoryWriteAccess(principal);
    return this.store.create(principal.workspaceId, input);
  }

  async get(
    principal: WorkspacePrincipal,
    relationshipId: string,
  ): Promise<StoredInventoryRelationship> {
    const relationship = await this.store.findById(
      principal.workspaceId,
      relationshipId,
    );
    if (!relationship) {
      throw new InventoryRecordNotFoundError();
    }
    return relationship;
  }

  async list(
    principal: WorkspacePrincipal,
    input: InventoryRelationshipListQuery,
  ): Promise<InventoryRelationshipServicePage> {
    const { cursor, ...filters } = input;
    const page = await this.store.list(principal.workspaceId, {
      ...filters,
      cursor: cursor ? decodeInventoryCursor(cursor) : undefined,
    });
    return {
      items: page.items,
      nextCursor: page.nextCursor
        ? encodeInventoryCursor(page.nextCursor)
        : null,
    };
  }

  async update(
    principal: WorkspacePrincipal,
    relationshipId: string,
    input: UpdateInventoryRelationshipRequest,
  ): Promise<StoredInventoryRelationship> {
    requireInventoryWriteAccess(principal);
    const relationship = await this.store.update(
      principal.workspaceId,
      relationshipId,
      input,
    );
    if (!relationship) {
      throw new InventoryRecordNotFoundError();
    }
    return relationship;
  }

  async archive(
    principal: WorkspacePrincipal,
    relationshipId: string,
  ): Promise<void> {
    requireInventoryWriteAccess(principal);
    const archived = await this.store.archive(
      principal.workspaceId,
      relationshipId,
    );
    if (!archived) {
      throw new InventoryRecordNotFoundError();
    }
  }
}
