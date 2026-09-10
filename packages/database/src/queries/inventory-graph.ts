import { and, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';

import type { DatabaseTransaction } from '../client/database-types';
import {
  inventoryNodes,
  inventoryRelationships,
  websiteApplications,
  type InventoryNode,
  type InventoryRelationship,
} from '../schema';

export type GraphEntityKind = InventoryNode['entityKind'];
export type InfrastructureRelationshipType =
  InventoryRelationship['relationshipType'];
export type InventoryRelationshipDirection = 'OUTBOUND' | 'INBOUND';
export type InventoryAssociationSource =
  | 'PRIMARY_STRUCTURAL'
  | 'FLEXIBLE_RELATIONSHIP';

export type HostingTargetKind = 'SERVER' | 'CLOUD_RESOURCE';
export type DependencySourceKind =
  | 'WEBSITE_APPLICATION'
  | 'SERVER'
  | 'CLOUD_RESOURCE';
export type DependencyTargetKind =
  | 'DOMAIN'
  | 'WEBSITE_APPLICATION'
  | 'SERVER'
  | 'CLOUD_RESOURCE';
export type ConnectableEntityKind = 'SERVER' | 'CLOUD_RESOURCE';

export interface InventoryEntityReference {
  readonly entityKind: GraphEntityKind;
  readonly entityId: string;
}

export interface ResolvedInventoryNode extends InventoryEntityReference {
  readonly nodeId: string;
}

export interface InventoryGraphRelationship {
  readonly id: string;
  readonly relationshipType: InfrastructureRelationshipType;
  readonly provenance: InventoryRelationship['provenance'];
  readonly inventoryState: InventoryRelationship['inventoryState'];
  readonly direction: InventoryRelationshipDirection;
  readonly oppositeEndpoint: InventoryEntityReference;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface InventoryRelationshipQueryOptions {
  readonly includeArchived?: boolean;
}

export interface AssociatedInventoryEntity extends InventoryEntityReference {
  readonly associationSources: readonly InventoryAssociationSource[];
}

export class InventoryNodeNotFoundError extends Error {
  readonly code = 'INVENTORY_NODE_NOT_FOUND';

  constructor() {
    super('Inventory entity was not found');
    this.name = 'InventoryNodeNotFoundError';
  }
}

const InventoryEntityIdSchema = z.uuid();
const currentWorkspaceId = sql<string>`"domainpulse"."current_workspace_id"()`;
const relationshipTargetNode = alias(
  inventoryNodes,
  'relationship_target_node',
);
const relationshipSourceNode = alias(
  inventoryNodes,
  'relationship_source_node',
);

function requireValidEntityId(entityId: string): string {
  const parsedEntityId = InventoryEntityIdSchema.safeParse(entityId);
  if (!parsedEntityId.success) {
    throw new InventoryNodeNotFoundError();
  }
  return parsedEntityId.data;
}

function trackedRelationshipCondition(
  options: InventoryRelationshipQueryOptions,
) {
  return options.includeArchived === true
    ? undefined
    : eq(inventoryRelationships.inventoryState, 'TRACKED');
}

export async function resolveInventoryNode(
  transaction: DatabaseTransaction,
  entityKind: GraphEntityKind,
  entityId: string,
): Promise<ResolvedInventoryNode> {
  const validatedEntityId = requireValidEntityId(entityId);
  const [node] = await transaction
    .select({
      entityId: inventoryNodes.entityId,
      entityKind: inventoryNodes.entityKind,
      nodeId: inventoryNodes.nodeId,
    })
    .from(inventoryNodes)
    .where(
      and(
        eq(inventoryNodes.workspaceId, currentWorkspaceId),
        eq(inventoryNodes.entityKind, entityKind),
        eq(inventoryNodes.entityId, validatedEntityId),
      ),
    )
    .limit(1);

  if (!node) {
    throw new InventoryNodeNotFoundError();
  }
  return node;
}

async function queryOutboundRelationships(
  transaction: DatabaseTransaction,
  node: ResolvedInventoryNode,
  options: InventoryRelationshipQueryOptions,
  relationshipType?: InfrastructureRelationshipType,
): Promise<InventoryGraphRelationship[]> {
  const rows = await transaction
    .select({
      createdAt: inventoryRelationships.createdAt,
      id: inventoryRelationships.id,
      inventoryState: inventoryRelationships.inventoryState,
      notes: inventoryRelationships.notes,
      oppositeEntityId: relationshipTargetNode.entityId,
      oppositeEntityKind: relationshipTargetNode.entityKind,
      provenance: inventoryRelationships.provenance,
      relationshipType: inventoryRelationships.relationshipType,
      updatedAt: inventoryRelationships.updatedAt,
    })
    .from(inventoryRelationships)
    .innerJoin(
      relationshipTargetNode,
      and(
        eq(
          relationshipTargetNode.workspaceId,
          inventoryRelationships.workspaceId,
        ),
        eq(relationshipTargetNode.nodeId, inventoryRelationships.targetNodeId),
        eq(relationshipTargetNode.entityKind, inventoryRelationships.targetKind),
      ),
    )
    .where(
      and(
        eq(inventoryRelationships.workspaceId, currentWorkspaceId),
        eq(inventoryRelationships.sourceKind, node.entityKind),
        eq(inventoryRelationships.sourceNodeId, node.nodeId),
        relationshipType
          ? eq(inventoryRelationships.relationshipType, relationshipType)
          : undefined,
        trackedRelationshipCondition(options),
      ),
    );

  return rows.map((row) => ({
    createdAt: row.createdAt,
    direction: 'OUTBOUND',
    id: row.id,
    inventoryState: row.inventoryState,
    notes: row.notes,
    oppositeEndpoint: {
      entityId: row.oppositeEntityId,
      entityKind: row.oppositeEntityKind,
    },
    provenance: row.provenance,
    relationshipType: row.relationshipType,
    updatedAt: row.updatedAt,
  }));
}

async function queryInboundRelationships(
  transaction: DatabaseTransaction,
  node: ResolvedInventoryNode,
  options: InventoryRelationshipQueryOptions,
  relationshipType?: InfrastructureRelationshipType,
): Promise<InventoryGraphRelationship[]> {
  const rows = await transaction
    .select({
      createdAt: inventoryRelationships.createdAt,
      id: inventoryRelationships.id,
      inventoryState: inventoryRelationships.inventoryState,
      notes: inventoryRelationships.notes,
      oppositeEntityId: relationshipSourceNode.entityId,
      oppositeEntityKind: relationshipSourceNode.entityKind,
      provenance: inventoryRelationships.provenance,
      relationshipType: inventoryRelationships.relationshipType,
      updatedAt: inventoryRelationships.updatedAt,
    })
    .from(inventoryRelationships)
    .innerJoin(
      relationshipSourceNode,
      and(
        eq(
          relationshipSourceNode.workspaceId,
          inventoryRelationships.workspaceId,
        ),
        eq(relationshipSourceNode.nodeId, inventoryRelationships.sourceNodeId),
        eq(relationshipSourceNode.entityKind, inventoryRelationships.sourceKind),
      ),
    )
    .where(
      and(
        eq(inventoryRelationships.workspaceId, currentWorkspaceId),
        eq(inventoryRelationships.targetKind, node.entityKind),
        eq(inventoryRelationships.targetNodeId, node.nodeId),
        relationshipType
          ? eq(inventoryRelationships.relationshipType, relationshipType)
          : undefined,
        trackedRelationshipCondition(options),
      ),
    );

  return rows.map((row) => ({
    createdAt: row.createdAt,
    direction: 'INBOUND',
    id: row.id,
    inventoryState: row.inventoryState,
    notes: row.notes,
    oppositeEndpoint: {
      entityId: row.oppositeEntityId,
      entityKind: row.oppositeEntityKind,
    },
    provenance: row.provenance,
    relationshipType: row.relationshipType,
    updatedAt: row.updatedAt,
  }));
}

export async function listOutboundInventoryRelationships(
  transaction: DatabaseTransaction,
  entityKind: GraphEntityKind,
  entityId: string,
  options: InventoryRelationshipQueryOptions = {},
): Promise<InventoryGraphRelationship[]> {
  const node = await resolveInventoryNode(transaction, entityKind, entityId);
  return queryOutboundRelationships(transaction, node, options);
}

export async function listInboundInventoryRelationships(
  transaction: DatabaseTransaction,
  entityKind: GraphEntityKind,
  entityId: string,
  options: InventoryRelationshipQueryOptions = {},
): Promise<InventoryGraphRelationship[]> {
  const node = await resolveInventoryNode(transaction, entityKind, entityId);
  return queryInboundRelationships(transaction, node, options);
}

export async function listImmediateInventoryRelationships(
  transaction: DatabaseTransaction,
  entityKind: GraphEntityKind,
  entityId: string,
  options: InventoryRelationshipQueryOptions = {},
): Promise<InventoryGraphRelationship[]> {
  const node = await resolveInventoryNode(transaction, entityKind, entityId);
  const outbound = await queryOutboundRelationships(transaction, node, options);
  const inbound = await queryInboundRelationships(transaction, node, options);
  return [...outbound, ...inbound];
}

function mergeAssociatedEntities(
  associations: readonly {
    readonly entityKind: GraphEntityKind;
    readonly entityId: string;
    readonly associationSource: InventoryAssociationSource;
  }[],
): AssociatedInventoryEntity[] {
  const merged = new Map<string, {
    entityKind: GraphEntityKind;
    entityId: string;
    associationSources: InventoryAssociationSource[];
  }>();

  for (const association of associations) {
    const key = `${association.entityKind}:${association.entityId}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        associationSources: [association.associationSource],
        entityId: association.entityId,
        entityKind: association.entityKind,
      });
      continue;
    }
    if (!existing.associationSources.includes(association.associationSource)) {
      existing.associationSources.push(association.associationSource);
    }
  }

  return [...merged.values()];
}

export async function listProjectResources(
  transaction: DatabaseTransaction,
  projectId: string,
  options: InventoryRelationshipQueryOptions = {},
): Promise<AssociatedInventoryEntity[]> {
  const projectNode = await resolveInventoryNode(
    transaction,
    'PROJECT',
    projectId,
  );
  const primaryApplications = await transaction
    .select({ entityId: websiteApplications.id })
    .from(websiteApplications)
    .where(
      and(
        eq(websiteApplications.workspaceId, currentWorkspaceId),
        eq(websiteApplications.projectId, projectNode.entityId),
      ),
    );
  const groupedResources = await queryOutboundRelationships(
    transaction,
    projectNode,
    options,
    'GROUPS',
  );

  return mergeAssociatedEntities([
    ...primaryApplications.map(({ entityId }) => ({
      associationSource: 'PRIMARY_STRUCTURAL' as const,
      entityId,
      entityKind: 'WEBSITE_APPLICATION' as const,
    })),
    ...groupedResources.map(({ oppositeEndpoint }) => ({
      associationSource: 'FLEXIBLE_RELATIONSHIP' as const,
      ...oppositeEndpoint,
    })),
  ]);
}

export async function listApplicationDomains(
  transaction: DatabaseTransaction,
  websiteApplicationId: string,
  options: InventoryRelationshipQueryOptions = {},
): Promise<AssociatedInventoryEntity[]> {
  const applicationNode = await resolveInventoryNode(
    transaction,
    'WEBSITE_APPLICATION',
    websiteApplicationId,
  );
  const [application] = await transaction
    .select({ primaryDomainId: websiteApplications.primaryDomainId })
    .from(websiteApplications)
    .where(
      and(
        eq(websiteApplications.workspaceId, currentWorkspaceId),
        eq(websiteApplications.id, applicationNode.entityId),
      ),
    )
    .limit(1);
  if (!application) {
    throw new InventoryNodeNotFoundError();
  }
  const additionalDomains = await queryOutboundRelationships(
    transaction,
    applicationNode,
    options,
    'USES_DOMAIN',
  );
  const associations: {
    entityKind: GraphEntityKind;
    entityId: string;
    associationSource: InventoryAssociationSource;
  }[] = additionalDomains.map(({ oppositeEndpoint }) => ({
    associationSource: 'FLEXIBLE_RELATIONSHIP',
    ...oppositeEndpoint,
  }));
  if (application.primaryDomainId) {
    associations.unshift({
      associationSource: 'PRIMARY_STRUCTURAL',
      entityId: application.primaryDomainId,
      entityKind: 'DOMAIN',
    });
  }
  return mergeAssociatedEntities(associations);
}

export async function listHostingTargetsForApplication(
  transaction: DatabaseTransaction,
  websiteApplicationId: string,
  options: InventoryRelationshipQueryOptions = {},
): Promise<InventoryGraphRelationship[]> {
  const applicationNode = await resolveInventoryNode(
    transaction,
    'WEBSITE_APPLICATION',
    websiteApplicationId,
  );
  return queryOutboundRelationships(
    transaction,
    applicationNode,
    options,
    'HOSTED_ON',
  );
}

export async function listApplicationsHostedOn(
  transaction: DatabaseTransaction,
  hostKind: HostingTargetKind,
  hostEntityId: string,
  options: InventoryRelationshipQueryOptions = {},
): Promise<InventoryGraphRelationship[]> {
  const hostNode = await resolveInventoryNode(
    transaction,
    hostKind,
    hostEntityId,
  );
  return queryInboundRelationships(
    transaction,
    hostNode,
    options,
    'HOSTED_ON',
  );
}

export async function listImmediateDependencies(
  transaction: DatabaseTransaction,
  sourceKind: DependencySourceKind,
  sourceEntityId: string,
  options: InventoryRelationshipQueryOptions = {},
): Promise<InventoryGraphRelationship[]> {
  const sourceNode = await resolveInventoryNode(
    transaction,
    sourceKind,
    sourceEntityId,
  );
  return queryOutboundRelationships(
    transaction,
    sourceNode,
    options,
    'DEPENDS_ON',
  );
}

export async function listImmediateDependents(
  transaction: DatabaseTransaction,
  targetKind: DependencyTargetKind,
  targetEntityId: string,
  options: InventoryRelationshipQueryOptions = {},
): Promise<InventoryGraphRelationship[]> {
  const targetNode = await resolveInventoryNode(
    transaction,
    targetKind,
    targetEntityId,
  );
  return queryInboundRelationships(
    transaction,
    targetNode,
    options,
    'DEPENDS_ON',
  );
}

export async function listConnectedInventoryEntities(
  transaction: DatabaseTransaction,
  entityKind: ConnectableEntityKind,
  entityId: string,
  options: InventoryRelationshipQueryOptions = {},
): Promise<InventoryGraphRelationship[]> {
  const node = await resolveInventoryNode(transaction, entityKind, entityId);
  const outbound = await queryOutboundRelationships(
    transaction,
    node,
    options,
    'CONNECTED_TO',
  );
  const inbound = await queryInboundRelationships(
    transaction,
    node,
    options,
    'CONNECTED_TO',
  );
  return [...outbound, ...inbound];
}
