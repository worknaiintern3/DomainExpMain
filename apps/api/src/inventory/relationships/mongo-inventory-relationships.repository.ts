import { randomUUID } from 'node:crypto';

import {
  InventoryConflictError,
  InventoryPersistenceError,
} from '../inventory.errors';
import type {
  InventoryRelationshipStore,
  InventoryRelationshipStoreListInput,
  InventoryRelationshipStorePage,
} from './relationships.types';
import type { StoredInventoryRelationship } from '@domainpulse/database';
import type { DatabaseService } from '../../database/database.service';

export class MongoInventoryRelationshipRepository
  implements InventoryRelationshipStore
{
  constructor(private readonly database: DatabaseService) {}

  async create(
    workspaceId: string,
    input: Parameters<InventoryRelationshipStore['create']>[1],
  ): Promise<StoredInventoryRelationship> {
    const collections = this.database.collections;
    if (!collections) {
      throw new InventoryPersistenceError();
    }

    const now = new Date();
    const id = randomUUID();

    const record: StoredInventoryRelationship = {
      id,
      source: input.source,
      target: input.target,
      relationshipType: input.relationshipType,
      notes: input.notes ?? null,
      inventoryState: 'TRACKED',
      provenance: 'USER_ADDED',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await (collections.inventoryRelationships as any).insertOne({
        ...record,
        workspaceId,
      });

      return record;
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new InventoryConflictError();
      }
      throw new InventoryPersistenceError();
    }
  }

  async findById(
    workspaceId: string,
    relationshipId: string,
  ): Promise<StoredInventoryRelationship | null> {
    const collections = this.database.collections;
    if (!collections) {
      throw new InventoryPersistenceError();
    }

    try {
      const doc = await (collections.inventoryRelationships as any).findOne({
        workspaceId,
        id: relationshipId,
      });

      if (!doc) {
        return null;
      }

      return {
        id: doc.id,
        source: doc.source,
        target: doc.target,
        relationshipType: doc.relationshipType,
        notes: doc.notes ?? null,
        inventoryState: doc.inventoryState,
        provenance: doc.provenance,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    } catch {
      throw new InventoryPersistenceError();
    }
  }

  async list(
    workspaceId: string,
    input: InventoryRelationshipStoreListInput,
  ): Promise<InventoryRelationshipStorePage> {
    const collections = this.database.collections;
    if (!collections) {
      throw new InventoryPersistenceError();
    }

    const limit = input.limit ?? 50;
    const filter: any = { workspaceId };
    if (!input.includeArchived) {
      filter.inventoryState = 'TRACKED';
    }
    if (input.relationshipType) {
      filter.relationshipType = input.relationshipType;
    }
    if (input.cursor) {
      const cursorDate = new Date(input.cursor.createdAt);
      filter.$or = [
        { createdAt: { $lt: cursorDate } },
        { createdAt: cursorDate, id: { $lt: input.cursor.id } },
      ];
    }

    try {
      const rows = await (collections.inventoryRelationships as any)
        .find(filter)
        .sort({ createdAt: -1, id: -1 })
        .limit(limit + 1)
        .toArray();

      const hasNextPage = rows.length > limit;
      const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
      const last = pageRows.at(-1);

      return {
        items: pageRows.map((doc: any) => ({
          id: doc.id,
          source: doc.source,
          target: doc.target,
          relationshipType: doc.relationshipType,
          notes: doc.notes ?? null,
          inventoryState: doc.inventoryState,
          provenance: doc.provenance,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        })),
        nextCursor:
          hasNextPage && last
            ? {
                createdAt:
                  last.createdAt instanceof Date
                    ? last.createdAt.toISOString()
                    : new Date(last.createdAt).toISOString(),
                id: last.id,
              }
            : null,
      };
    } catch {
      throw new InventoryPersistenceError();
    }
  }

  async update(
    workspaceId: string,
    relationshipId: string,
    input: Parameters<InventoryRelationshipStore['update']>[2],
  ): Promise<StoredInventoryRelationship | null> {
    const collections = this.database.collections;
    if (!collections) {
      throw new InventoryPersistenceError();
    }

    const now = new Date();
    try {
      const doc = await (collections.inventoryRelationships as any).findOneAndUpdate(
        { workspaceId, id: relationshipId },
        {
          $set: {
            notes: input.notes ?? null,
            updatedAt: now,
          },
        },
        { returnDocument: 'after' },
      );

      if (!doc) {
        return null;
      }

      return {
        id: doc.id,
        source: doc.source,
        target: doc.target,
        relationshipType: doc.relationshipType,
        notes: doc.notes ?? null,
        inventoryState: doc.inventoryState,
        provenance: doc.provenance,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    } catch {
      throw new InventoryPersistenceError();
    }
  }

  async archive(
    workspaceId: string,
    relationshipId: string,
  ): Promise<boolean> {
    const collections = this.database.collections;
    if (!collections) {
      throw new InventoryPersistenceError();
    }

    try {
      const res = await (collections.inventoryRelationships as any).updateOne(
        { workspaceId, id: relationshipId },
        {
          $set: {
            inventoryState: 'ARCHIVED',
            updatedAt: new Date(),
          },
        },
      );
      return res.matchedCount > 0;
    } catch {
      throw new InventoryPersistenceError();
    }
  }
}
