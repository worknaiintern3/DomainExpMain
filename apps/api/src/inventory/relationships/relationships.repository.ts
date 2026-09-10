import {
  archiveStoredInventoryRelationship,
  createStoredInventoryRelationship,
  getStoredInventoryRelationship,
  InvalidInventoryRelationshipError,
  InventoryNodeNotFoundError,
  InventoryRelationshipSemanticConflictError,
  listStoredInventoryRelationships,
  StoredInventoryRelationshipNotFoundError,
  updateStoredInventoryRelationship,
} from '@domainpulse/database';

import {
  InvalidInventoryInputError,
  InventoryConflictError,
  InventoryPersistenceError,
  InventoryRecordNotFoundError,
} from '../inventory.errors';
import type {
  InventoryRelationshipStore,
  InventoryRelationshipStoreListInput,
  InventoryRelationshipStorePage,
  RelationshipDatabaseHost,
} from './relationships.types';

const POSTGRESQL_UNIQUE_VIOLATION = '23505';
const POSTGRESQL_FOREIGN_KEY_VIOLATION = '23503';
const POSTGRESQL_CHECK_VIOLATION = '23514';
const POSTGRESQL_INVALID_TEXT_REPRESENTATION = '22P02';

function getPostgreSqlErrorCode(error: unknown): string | undefined {
  const visited = new Set<object>();
  let current = error;
  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) {
      return undefined;
    }
    visited.add(current);
    const shape = current as { cause?: unknown; code?: unknown };
    if (typeof shape.code === 'string') {
      return shape.code;
    }
    current = shape.cause;
  }
  return undefined;
}

function translateRelationshipPersistenceError(error: unknown): never {
  if (
    error instanceof InventoryRecordNotFoundError ||
    error instanceof InventoryConflictError ||
    error instanceof InvalidInventoryInputError ||
    error instanceof InventoryPersistenceError
  ) {
    throw error;
  }
  if (
    error instanceof InventoryNodeNotFoundError ||
    error instanceof StoredInventoryRelationshipNotFoundError
  ) {
    throw new InventoryRecordNotFoundError();
  }
  if (
    error instanceof InvalidInventoryRelationshipError ||
    error instanceof InventoryRelationshipSemanticConflictError
  ) {
    throw new InvalidInventoryInputError();
  }

  const code = getPostgreSqlErrorCode(error);
  if (code === POSTGRESQL_UNIQUE_VIOLATION) {
    throw new InventoryConflictError();
  }
  if (code === POSTGRESQL_FOREIGN_KEY_VIOLATION) {
    throw new InventoryRecordNotFoundError();
  }
  if (
    code === POSTGRESQL_CHECK_VIOLATION ||
    code === POSTGRESQL_INVALID_TEXT_REPRESENTATION
  ) {
    throw new InvalidInventoryInputError();
  }
  throw new InventoryPersistenceError();
}

export class PostgresInventoryRelationshipRepository
  implements InventoryRelationshipStore
{
  constructor(private readonly database: RelationshipDatabaseHost) {}

  async create(
    workspaceId: string,
    input: Parameters<InventoryRelationshipStore['create']>[1],
  ) {
    try {
      return await this.database.withWorkspaceContext(
        workspaceId,
        async (transaction) =>
          createStoredInventoryRelationship(transaction, input),
      );
    } catch (error) {
      translateRelationshipPersistenceError(error);
    }
  }

  async findById(workspaceId: string, relationshipId: string) {
    try {
      return await this.database.withWorkspaceContext(
        workspaceId,
        async (transaction) => {
          try {
            return await getStoredInventoryRelationship(
              transaction,
              relationshipId,
            );
          } catch (error) {
            if (error instanceof StoredInventoryRelationshipNotFoundError) {
              return null;
            }
            throw error;
          }
        },
      );
    } catch (error) {
      translateRelationshipPersistenceError(error);
    }
  }

  async list(
    workspaceId: string,
    input: InventoryRelationshipStoreListInput,
  ): Promise<InventoryRelationshipStorePage> {
    try {
      return await this.database.withWorkspaceContext(
        workspaceId,
        async (transaction) =>
          listStoredInventoryRelationships(transaction, {
            cursor: input.cursor,
            includeArchived: input.includeArchived,
            limit: input.limit,
            relationshipType: input.relationshipType,
            source:
              input.sourceEntityKind && input.sourceEntityId
                ? {
                    entityId: input.sourceEntityId,
                    entityKind: input.sourceEntityKind,
                  }
                : undefined,
            target:
              input.targetEntityKind && input.targetEntityId
                ? {
                    entityId: input.targetEntityId,
                    entityKind: input.targetEntityKind,
                  }
                : undefined,
          }),
      );
    } catch (error) {
      translateRelationshipPersistenceError(error);
    }
  }

  async update(
    workspaceId: string,
    relationshipId: string,
    input: Parameters<InventoryRelationshipStore['update']>[2],
  ) {
    try {
      return await this.database.withWorkspaceContext(
        workspaceId,
        async (transaction) => {
          try {
            return await updateStoredInventoryRelationship(
              transaction,
              relationshipId,
              input,
            );
          } catch (error) {
            if (error instanceof StoredInventoryRelationshipNotFoundError) {
              return null;
            }
            throw error;
          }
        },
      );
    } catch (error) {
      translateRelationshipPersistenceError(error);
    }
  }

  async archive(workspaceId: string, relationshipId: string) {
    try {
      return await this.database.withWorkspaceContext(
        workspaceId,
        async (transaction) => {
          try {
            await archiveStoredInventoryRelationship(
              transaction,
              relationshipId,
            );
            return true;
          } catch (error) {
            if (error instanceof StoredInventoryRelationshipNotFoundError) {
              return false;
            }
            throw error;
          }
        },
      );
    } catch (error) {
      translateRelationshipPersistenceError(error);
    }
  }
}
