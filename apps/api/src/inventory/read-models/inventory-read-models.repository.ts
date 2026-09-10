import {
  InventoryNodeNotFoundError,
  listApplicationDomains,
  listApplicationsHostedOn,
  listConnectedInventoryEntities,
  listHostingTargetsForApplication,
  listImmediateDependencies,
  listImmediateDependents,
  listImmediateInventoryRelationships,
  listProjectResources,
  type DatabaseTransactionOperation,
} from '@domainpulse/database';

import {
  InventoryPersistenceError,
  InventoryRecordNotFoundError,
} from '../inventory.errors';
import type {
  InventoryReadModelDatabaseHost,
  InventoryReadModelStore,
} from './inventory-read-models.types';

export class PostgresInventoryReadModelRepository
  implements InventoryReadModelStore
{
  constructor(private readonly database: InventoryReadModelDatabaseHost) {}

  private async read<T>(
    workspaceId: string,
    operation: DatabaseTransactionOperation<T>,
  ): Promise<T> {
    try {
      return await this.database.withWorkspaceContext(workspaceId, operation);
    } catch (error) {
      if (error instanceof InventoryNodeNotFoundError) {
        throw new InventoryRecordNotFoundError();
      }
      throw new InventoryPersistenceError();
    }
  }

  listProjectResources(
    workspaceId: string,
    projectId: string,
    options: Parameters<InventoryReadModelStore['listProjectResources']>[2],
  ) {
    return this.read(workspaceId, (transaction) =>
      listProjectResources(transaction, projectId, options),
    );
  }

  listApplicationDomains(
    workspaceId: string,
    applicationId: string,
    options: Parameters<InventoryReadModelStore['listApplicationDomains']>[2],
  ) {
    return this.read(workspaceId, (transaction) =>
      listApplicationDomains(transaction, applicationId, options),
    );
  }

  listApplicationHostingTargets(
    workspaceId: string,
    applicationId: string,
    options: Parameters<
      InventoryReadModelStore['listApplicationHostingTargets']
    >[2],
  ) {
    return this.read(workspaceId, (transaction) =>
      listHostingTargetsForApplication(transaction, applicationId, options),
    );
  }

  listHostedApplications(
    workspaceId: string,
    hostKind: Parameters<InventoryReadModelStore['listHostedApplications']>[1],
    hostId: string,
    options: Parameters<InventoryReadModelStore['listHostedApplications']>[3],
  ) {
    return this.read(workspaceId, (transaction) =>
      listApplicationsHostedOn(
        transaction,
        hostKind,
        hostId,
        options,
      ),
    );
  }

  listDependencies(
    workspaceId: string,
    sourceKind: Parameters<InventoryReadModelStore['listDependencies']>[1],
    sourceId: string,
    options: Parameters<InventoryReadModelStore['listDependencies']>[3],
  ) {
    return this.read(workspaceId, (transaction) =>
      listImmediateDependencies(transaction, sourceKind, sourceId, options),
    );
  }

  listDependents(
    workspaceId: string,
    targetKind: Parameters<InventoryReadModelStore['listDependents']>[1],
    targetId: string,
    options: Parameters<InventoryReadModelStore['listDependents']>[3],
  ) {
    return this.read(workspaceId, (transaction) =>
      listImmediateDependents(transaction, targetKind, targetId, options),
    );
  }

  listConnections(
    workspaceId: string,
    entityKind: Parameters<InventoryReadModelStore['listConnections']>[1],
    entityId: string,
    options: Parameters<InventoryReadModelStore['listConnections']>[3],
  ) {
    return this.read(workspaceId, (transaction) =>
      listConnectedInventoryEntities(
        transaction,
        entityKind,
        entityId,
        options,
      ),
    );
  }

  listImmediateRelationships(
    workspaceId: string,
    entityKind: Parameters<
      InventoryReadModelStore['listImmediateRelationships']
    >[1],
    entityId: string,
    options: Parameters<
      InventoryReadModelStore['listImmediateRelationships']
    >[3],
  ) {
    return this.read(workspaceId, (transaction) =>
      listImmediateInventoryRelationships(
        transaction,
        entityKind,
        entityId,
        options,
      ),
    );
  }
}
