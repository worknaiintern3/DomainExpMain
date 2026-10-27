import { randomUUID } from 'node:crypto';

import {
  InventoryConflictError,
  InventoryPersistenceError,
} from './inventory.errors';
import type {
  InventoryRecordEnvelope,
  InventoryResourceKind,
  InventoryStore,
  InventoryStoreListInput,
  InventoryStorePage,
  PersistInventoryCreateCommand,
  PersistInventoryUpdateCommand,
} from './inventory.types';
import type { DatabaseService } from '../database/database.service';

export class MongoInventoryRepository implements InventoryStore {
  constructor(private readonly database: DatabaseService) {}

  private getCollection(resource: InventoryResourceKind) {
    const cols = this.database.collections;
    if (!cols) {
      throw new InventoryPersistenceError();
    }
    switch (resource) {
      case 'email-account':
        return cols.emailAccounts;
      case 'provider-account':
        return cols.providerAccounts;
      case 'project':
        return cols.projects;
      case 'domain':
        return cols.domains;
      case 'server':
        return cols.servers;
      case 'cloud-resource':
        return cols.cloudResources;
      case 'application':
        return cols.websiteApplications;
    }
  }

  async create(
    workspaceId: string,
    command: PersistInventoryCreateCommand,
  ): Promise<InventoryRecordEnvelope> {
    const collection = this.getCollection(command.resource);
    const now = new Date();
    const id = randomUUID();

    const record: any = {
      id,
      workspaceId,
      inventoryState: 'TRACKED',
      provenance: 'USER_ADDED',
      ...command.values,
      createdAt: now,
      updatedAt: now,
    };

    if (command.resource === 'domain') {
      const punycode = (
        (command.values as any).punycode ||
        (command.values as any).normalizedDomainName ||
        (command.values as any).domainName ||
        ''
      ).toLowerCase();
      record.punycode = punycode;
      record.normalizedDomainName = punycode;

      const existing = await (collection as any).findOne({ workspaceId, punycode });
      if (existing) {
        const updated = await (collection as any).findOneAndUpdate(
          { _id: existing._id },
          {
            $set: {
              ...command.values,
              inventoryState: 'TRACKED',
              updatedAt: now,
            },
          },
          { returnDocument: 'after' },
        );
        return {
          resource: command.resource,
          record: updated || existing,
        } as InventoryRecordEnvelope;
      }
    }

    try {
      await (collection as any).insertOne(record);
      return {
        resource: command.resource,
        record,
      } as InventoryRecordEnvelope;
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new InventoryConflictError();
      }
      throw new InventoryPersistenceError();
    }
  }

  async findById(
    workspaceId: string,
    resource: InventoryResourceKind,
    id: string,
  ): Promise<InventoryRecordEnvelope | undefined> {
    const collection = this.getCollection(resource);
    try {
      const record = await (collection as any).findOne({
        workspaceId,
        id,
      });
      return record ? ({ resource, record } as InventoryRecordEnvelope) : undefined;
    } catch {
      throw new InventoryPersistenceError();
    }
  }

  async list(
    workspaceId: string,
    resource: InventoryResourceKind,
    input: InventoryStoreListInput,
  ): Promise<InventoryStorePage> {
    const collection = this.getCollection(resource);
    try {
      const filter: any = { workspaceId };
      if (!input.includeArchived) {
        filter.inventoryState = 'TRACKED';
      }
      if (input.cursor) {
        const cursorDate = new Date(input.cursor.createdAt);
        filter.$or = [
          { createdAt: { $lt: cursorDate } },
          { createdAt: cursorDate, id: { $lt: input.cursor.id } },
        ];
      }

      const rows = await (collection as any)
        .find(filter)
        .sort({ createdAt: -1, id: -1 })
        .limit(input.limit + 1)
        .toArray();

      const hasNextPage = rows.length > input.limit;
      const pageRows = hasNextPage ? rows.slice(0, input.limit) : rows;
      const last = pageRows.at(-1);

      return {
        items: pageRows.map((record: any) => ({
          resource,
          record,
        })) as any,
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
    id: string,
    command: PersistInventoryUpdateCommand,
  ): Promise<InventoryRecordEnvelope | undefined> {
    const collection = this.getCollection(command.resource);
    const now = new Date();

    try {
      const updated = await (collection as any).findOneAndUpdate(
        { workspaceId, id },
        {
          $set: {
            ...command.values,
            updatedAt: now,
          },
        },
        { returnDocument: 'after' },
      );

      return updated
        ? ({ resource: command.resource, record: updated } as InventoryRecordEnvelope)
        : undefined;
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new InventoryConflictError();
      }
      throw new InventoryPersistenceError();
    }
  }

  async archive(
    workspaceId: string,
    resource: InventoryResourceKind,
    id: string,
  ): Promise<boolean> {
    const collection = this.getCollection(resource);
    const now = new Date();

    try {
      const res = await (collection as any).updateOne(
        { workspaceId, id },
        {
          $set: {
            inventoryState: 'ARCHIVED',
            updatedAt: now,
          },
        },
      );
      return res.matchedCount > 0;
    } catch {
      throw new InventoryPersistenceError();
    }
  }
}
