import type {
  AssociatedInventoryEntity,
  ConnectableEntityKind,
  DependencySourceKind,
  DependencyTargetKind,
  GraphEntityKind,
  HostingTargetKind,
  InventoryGraphRelationship,
  InventoryRelationshipQueryOptions,
} from '@domainpulse/database';

import {
  InventoryPersistenceError,
} from '../inventory.errors';
import type { InventoryReadModelStore } from './inventory-read-models.types';
import type { DatabaseService } from '../../database/database.service';

export class MongoInventoryReadModelRepository
  implements InventoryReadModelStore
{
  constructor(private readonly database: DatabaseService) {}

  private get relCol() {
    const cols = this.database.collections;
    if (!cols) {
      throw new InventoryPersistenceError();
    }
    return cols.inventoryRelationships;
  }

  async listProjectResources(
    workspaceId: string,
    projectId: string,
    options: InventoryRelationshipQueryOptions,
  ): Promise<readonly AssociatedInventoryEntity[]> {
    const cols = this.database.collections;
    if (!cols) {
      throw new InventoryPersistenceError();
    }

    const stateFilter = options.includeArchived ? {} : { inventoryState: 'TRACKED' };

    try {
      const [apps, domains, servers] = await Promise.all([
        cols.websiteApplications
          .find({ workspaceId, projectId, ...stateFilter } as any)
          .toArray(),
        cols.domains
          .find({ workspaceId, projectId, ...stateFilter } as any)
          .toArray(),
        cols.servers
          .find({ workspaceId, projectId, ...stateFilter } as any)
          .toArray(),
      ]);

      const results: AssociatedInventoryEntity[] = [];
      for (const a of apps) {
        results.push({
          entityKind: 'WEBSITE_APPLICATION',
          entityId: a.id,
          associationSources: ['PRIMARY_STRUCTURAL'],
        });
      }
      for (const d of domains) {
        results.push({
          entityKind: 'DOMAIN',
          entityId: d.id,
          associationSources: ['PRIMARY_STRUCTURAL'],
        });
      }
      for (const s of servers) {
        results.push({
          entityKind: 'SERVER',
          entityId: s.id,
          associationSources: ['PRIMARY_STRUCTURAL'],
        });
      }

      return results;
    } catch {
      throw new InventoryPersistenceError();
    }
  }

  async listApplicationDomains(
    workspaceId: string,
    applicationId: string,
    _options: InventoryRelationshipQueryOptions,
  ): Promise<readonly AssociatedInventoryEntity[]> {
    const cols = this.database.collections;
    if (!cols) {
      throw new InventoryPersistenceError();
    }

    try {
      const app = await cols.websiteApplications.findOne({
        workspaceId,
        id: applicationId,
      });

      const results: AssociatedInventoryEntity[] = [];
      if (app && (app as any).primaryDomainId) {
        results.push({
          entityKind: 'DOMAIN',
          entityId: (app as any).primaryDomainId,
          associationSources: ['PRIMARY_STRUCTURAL'],
        });
      }

      return results;
    } catch {
      throw new InventoryPersistenceError();
    }
  }

  async listApplicationHostingTargets(
    workspaceId: string,
    applicationId: string,
    options: InventoryRelationshipQueryOptions,
  ): Promise<readonly InventoryGraphRelationship[]> {
    const cols = this.database.collections;
    if (!cols) {
      throw new InventoryPersistenceError();
    }

    try {
      const filter: any = {
        workspaceId,
        'source.entityKind': 'WEBSITE_APPLICATION',
        'source.entityId': applicationId,
      };
      if (!options.includeArchived) {
        filter.inventoryState = 'TRACKED';
      }

      const rels = await (this.relCol as any).find(filter).toArray();
      return rels.map((r: any) => ({
        id: r.id,
        relationshipType: r.relationshipType,
        provenance: r.provenance,
        inventoryState: r.inventoryState,
        direction: 'OUTBOUND',
        oppositeEndpoint: r.target,
        notes: r.notes ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    } catch {
      throw new InventoryPersistenceError();
    }
  }

  async listHostedApplications(
    workspaceId: string,
    hostKind: HostingTargetKind,
    hostId: string,
    options: InventoryRelationshipQueryOptions,
  ): Promise<readonly InventoryGraphRelationship[]> {
    try {
      const filter: any = {
        workspaceId,
        'target.entityKind': hostKind,
        'target.entityId': hostId,
      };
      if (!options.includeArchived) {
        filter.inventoryState = 'TRACKED';
      }

      const rels = await (this.relCol as any).find(filter).toArray();
      return rels.map((r: any) => ({
        id: r.id,
        relationshipType: r.relationshipType,
        provenance: r.provenance,
        inventoryState: r.inventoryState,
        direction: 'INBOUND',
        oppositeEndpoint: r.source,
        notes: r.notes ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    } catch {
      throw new InventoryPersistenceError();
    }
  }

  async listDependencies(
    workspaceId: string,
    sourceKind: DependencySourceKind,
    sourceId: string,
    options: InventoryRelationshipQueryOptions,
  ): Promise<readonly InventoryGraphRelationship[]> {
    try {
      const filter: any = {
        workspaceId,
        'source.entityKind': sourceKind,
        'source.entityId': sourceId,
      };
      if (!options.includeArchived) {
        filter.inventoryState = 'TRACKED';
      }

      const rels = await (this.relCol as any).find(filter).toArray();
      return rels.map((r: any) => ({
        id: r.id,
        relationshipType: r.relationshipType,
        provenance: r.provenance,
        inventoryState: r.inventoryState,
        direction: 'OUTBOUND',
        oppositeEndpoint: r.target,
        notes: r.notes ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    } catch {
      throw new InventoryPersistenceError();
    }
  }

  async listDependents(
    workspaceId: string,
    targetKind: DependencyTargetKind,
    targetId: string,
    options: InventoryRelationshipQueryOptions,
  ): Promise<readonly InventoryGraphRelationship[]> {
    try {
      const filter: any = {
        workspaceId,
        'target.entityKind': targetKind,
        'target.entityId': targetId,
      };
      if (!options.includeArchived) {
        filter.inventoryState = 'TRACKED';
      }

      const rels = await (this.relCol as any).find(filter).toArray();
      return rels.map((r: any) => ({
        id: r.id,
        relationshipType: r.relationshipType,
        provenance: r.provenance,
        inventoryState: r.inventoryState,
        direction: 'INBOUND',
        oppositeEndpoint: r.source,
        notes: r.notes ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    } catch {
      throw new InventoryPersistenceError();
    }
  }

  async listConnections(
    workspaceId: string,
    entityKind: ConnectableEntityKind,
    entityId: string,
    options: InventoryRelationshipQueryOptions,
  ): Promise<readonly InventoryGraphRelationship[]> {
    return this.listImmediateRelationships(workspaceId, entityKind, entityId, options);
  }

  async listImmediateRelationships(
    workspaceId: string,
    entityKind: GraphEntityKind,
    entityId: string,
    options: InventoryRelationshipQueryOptions,
  ): Promise<readonly InventoryGraphRelationship[]> {
    try {
      const stateFilter = options.includeArchived ? {} : { inventoryState: 'TRACKED' };
      const [outbound, inbound] = await Promise.all([
        (this.relCol as any)
          .find({
            workspaceId,
            'source.entityKind': entityKind,
            'source.entityId': entityId,
            ...stateFilter,
          })
          .toArray(),
        (this.relCol as any)
          .find({
            workspaceId,
            'target.entityKind': entityKind,
            'target.entityId': entityId,
            ...stateFilter,
          })
          .toArray(),
      ]);

      const results: InventoryGraphRelationship[] = [];
      for (const r of outbound) {
        results.push({
          id: r.id,
          relationshipType: r.relationshipType,
          provenance: r.provenance,
          inventoryState: r.inventoryState,
          direction: 'OUTBOUND',
          oppositeEndpoint: r.target,
          notes: r.notes ?? null,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        });
      }
      for (const r of inbound) {
        results.push({
          id: r.id,
          relationshipType: r.relationshipType,
          provenance: r.provenance,
          inventoryState: r.inventoryState,
          direction: 'INBOUND',
          oppositeEndpoint: r.source,
          notes: r.notes ?? null,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        });
      }

      return results;
    } catch {
      throw new InventoryPersistenceError();
    }
  }

  async getInventorySummary(workspaceId: string): Promise<any> {
    const cols = this.database.collections;
    if (!cols) {
      throw new InventoryPersistenceError();
    }

    try {
      const [domainsCount, serversCount, appsCount, alertsCount, domainDocs] = await Promise.all([
        cols.domains.countDocuments({ workspaceId, inventoryState: 'TRACKED' } as any),
        cols.servers.countDocuments({ workspaceId, inventoryState: 'TRACKED' } as any),
        cols.websiteApplications.countDocuments({ workspaceId, inventoryState: 'TRACKED' } as any),
        cols.alertEvents.countDocuments({ workspaceId, status: 'active' } as any),
        cols.domains
          .find({ workspaceId, inventoryState: 'TRACKED' } as any, { projection: { expiresAt: 1, renewalPrice: 1 } })
          .toArray(),
      ]);

      const now = Date.now();
      let critical = 0;
      let warning = 0;
      let safe = 0;
      let renewalCost = 0;

      for (const d of domainDocs) {
        renewalCost += (d as any).renewalPrice || 899;
        const expTime = (d as any).expiresAt ? new Date((d as any).expiresAt).getTime() : NaN;
        const days = !isNaN(expTime) ? Math.max(0, Math.ceil((expTime - now) / 86400000)) : 365;
        if (days <= 10) critical++;
        else if (days <= 30) warning++;
        else safe++;
      }

      return {
        domains: domainsCount,
        criticalExpirations: critical,
        warningExpirations: warning,
        safeDomains: safe,
        upcomingRenewals: critical + warning,
        estimatedRenewalCost: renewalCost,
        currency: '₹',
        servers: serversCount,
        cloudResources: 0,
        applications: appsCount,
        alerts: alertsCount || (critical + warning),
      };
    } catch {
      throw new InventoryPersistenceError();
    }
  }
}
