import type {
  AssociatedInventoryEntity,
  ConnectableEntityKind,
  DatabaseTransactionOperation,
  DependencySourceKind,
  DependencyTargetKind,
  GraphEntityKind,
  HostingTargetKind,
  InventoryGraphRelationship,
  InventoryRelationshipQueryOptions,
} from '@domainpulse/database';

export interface InventoryReadModelDatabaseHost {
  withWorkspaceContext<T>(
    workspaceId: string,
    operation: DatabaseTransactionOperation<T>,
  ): Promise<T>;
}

export interface InventoryReadModelStore {
  listProjectResources(
    workspaceId: string,
    projectId: string,
    options: InventoryRelationshipQueryOptions,
  ): Promise<readonly AssociatedInventoryEntity[]>;
  listApplicationDomains(
    workspaceId: string,
    applicationId: string,
    options: InventoryRelationshipQueryOptions,
  ): Promise<readonly AssociatedInventoryEntity[]>;
  listApplicationHostingTargets(
    workspaceId: string,
    applicationId: string,
    options: InventoryRelationshipQueryOptions,
  ): Promise<readonly InventoryGraphRelationship[]>;
  listHostedApplications(
    workspaceId: string,
    hostKind: HostingTargetKind,
    hostId: string,
    options: InventoryRelationshipQueryOptions,
  ): Promise<readonly InventoryGraphRelationship[]>;
  listDependencies(
    workspaceId: string,
    sourceKind: DependencySourceKind,
    sourceId: string,
    options: InventoryRelationshipQueryOptions,
  ): Promise<readonly InventoryGraphRelationship[]>;
  listDependents(
    workspaceId: string,
    targetKind: DependencyTargetKind,
    targetId: string,
    options: InventoryRelationshipQueryOptions,
  ): Promise<readonly InventoryGraphRelationship[]>;
  listConnections(
    workspaceId: string,
    entityKind: ConnectableEntityKind,
    entityId: string,
    options: InventoryRelationshipQueryOptions,
  ): Promise<readonly InventoryGraphRelationship[]>;
  listImmediateRelationships(
    workspaceId: string,
    entityKind: GraphEntityKind,
    entityId: string,
    options: InventoryRelationshipQueryOptions,
  ): Promise<readonly InventoryGraphRelationship[]>;
}
