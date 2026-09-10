import type { InventoryGraphReadQuery } from '@domainpulse/contracts';
import type {
  ConnectableEntityKind,
  DependencySourceKind,
  DependencyTargetKind,
  GraphEntityKind,
  HostingTargetKind,
} from '@domainpulse/database';

import type { WorkspacePrincipal } from '../../workspace-context';
import type { InventoryReadModelStore } from './inventory-read-models.types';

export class InventoryReadModelService {
  constructor(private readonly store: InventoryReadModelStore) {}

  listProjectResources(
    principal: WorkspacePrincipal,
    projectId: string,
    query: InventoryGraphReadQuery,
  ) {
    return this.store.listProjectResources(
      principal.workspaceId,
      projectId,
      query,
    );
  }

  listApplicationDomains(
    principal: WorkspacePrincipal,
    applicationId: string,
    query: InventoryGraphReadQuery,
  ) {
    return this.store.listApplicationDomains(
      principal.workspaceId,
      applicationId,
      query,
    );
  }

  listApplicationHostingTargets(
    principal: WorkspacePrincipal,
    applicationId: string,
    query: InventoryGraphReadQuery,
  ) {
    return this.store.listApplicationHostingTargets(
      principal.workspaceId,
      applicationId,
      query,
    );
  }

  listHostedApplications(
    principal: WorkspacePrincipal,
    hostKind: HostingTargetKind,
    hostId: string,
    query: InventoryGraphReadQuery,
  ) {
    return this.store.listHostedApplications(
      principal.workspaceId,
      hostKind,
      hostId,
      query,
    );
  }

  listDependencies(
    principal: WorkspacePrincipal,
    sourceKind: DependencySourceKind,
    sourceId: string,
    query: InventoryGraphReadQuery,
  ) {
    return this.store.listDependencies(
      principal.workspaceId,
      sourceKind,
      sourceId,
      query,
    );
  }

  listDependents(
    principal: WorkspacePrincipal,
    targetKind: DependencyTargetKind,
    targetId: string,
    query: InventoryGraphReadQuery,
  ) {
    return this.store.listDependents(
      principal.workspaceId,
      targetKind,
      targetId,
      query,
    );
  }

  listConnections(
    principal: WorkspacePrincipal,
    entityKind: ConnectableEntityKind,
    entityId: string,
    query: InventoryGraphReadQuery,
  ) {
    return this.store.listConnections(
      principal.workspaceId,
      entityKind,
      entityId,
      query,
    );
  }

  listImmediateRelationships(
    principal: WorkspacePrincipal,
    entityKind: GraphEntityKind,
    entityId: string,
    query: InventoryGraphReadQuery,
  ) {
    return this.store.listImmediateRelationships(
      principal.workspaceId,
      entityKind,
      entityId,
      query,
    );
  }
}
