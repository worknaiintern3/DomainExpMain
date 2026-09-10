import { and, desc, eq, sql } from 'drizzle-orm';
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

export interface StoredInventoryRelationship {
  readonly id: string;
  readonly source: InventoryEntityReference;
  readonly relationshipType: InfrastructureRelationshipType;
  readonly target: InventoryEntityReference;
  readonly inventoryState: InventoryRelationship['inventoryState'];
  readonly provenance: InventoryRelationship['provenance'];
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface InventoryRelationshipCursorPosition {
  readonly createdAt: string;
  readonly id: string;
}

export interface CreateStoredInventoryRelationshipInput {
  readonly source: InventoryEntityReference;
  readonly relationshipType: InfrastructureRelationshipType;
  readonly target: InventoryEntityReference;
  readonly notes?: string | null | undefined;
}

export interface UpdateStoredInventoryRelationshipInput {
  readonly inventoryState?: InventoryRelationship['inventoryState'] | undefined;
  readonly notes?: string | null | undefined;
}

export interface ListStoredInventoryRelationshipsInput {
  readonly cursor?: InventoryRelationshipCursorPosition | undefined;
  readonly includeArchived: boolean;
  readonly limit: number;
  readonly relationshipType?: InfrastructureRelationshipType | undefined;
  readonly source?: InventoryEntityReference | undefined;
  readonly target?: InventoryEntityReference | undefined;
}

export interface StoredInventoryRelationshipPage {
  readonly items: readonly StoredInventoryRelationship[];
  readonly nextCursor: InventoryRelationshipCursorPosition | null;
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

export class InvalidInventoryRelationshipError extends Error {
  readonly code = 'INVALID_INVENTORY_RELATIONSHIP';

  constructor() {
    super('Invalid inventory relationship');
    this.name = 'InvalidInventoryRelationshipError';
  }
}

export class InventoryRelationshipSemanticConflictError extends Error {
  readonly code = 'INVENTORY_RELATIONSHIP_SEMANTIC_CONFLICT';

  constructor() {
    super('Relationship duplicates a primary structural association');
    this.name = 'InventoryRelationshipSemanticConflictError';
  }
}

export class StoredInventoryRelationshipNotFoundError extends Error {
  readonly code = 'STORED_INVENTORY_RELATIONSHIP_NOT_FOUND';

  constructor() {
    super('Inventory relationship was not found');
    this.name = 'StoredInventoryRelationshipNotFoundError';
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

const relationshipKinds: Readonly<
  Record<
    InfrastructureRelationshipType,
    readonly (readonly [GraphEntityKind, GraphEntityKind])[]
  >
> = {
  GROUPS: [
    ['PROJECT', 'DOMAIN'],
    ['PROJECT', 'SERVER'],
    ['PROJECT', 'CLOUD_RESOURCE'],
    ['PROJECT', 'WEBSITE_APPLICATION'],
  ],
  HOSTED_ON: [
    ['WEBSITE_APPLICATION', 'SERVER'],
    ['WEBSITE_APPLICATION', 'CLOUD_RESOURCE'],
  ],
  USES_DOMAIN: [['WEBSITE_APPLICATION', 'DOMAIN']],
  DEPENDS_ON: [
    ['WEBSITE_APPLICATION', 'DOMAIN'],
    ['WEBSITE_APPLICATION', 'WEBSITE_APPLICATION'],
    ['WEBSITE_APPLICATION', 'SERVER'],
    ['WEBSITE_APPLICATION', 'CLOUD_RESOURCE'],
    ['SERVER', 'DOMAIN'],
    ['SERVER', 'WEBSITE_APPLICATION'],
    ['SERVER', 'SERVER'],
    ['SERVER', 'CLOUD_RESOURCE'],
    ['CLOUD_RESOURCE', 'DOMAIN'],
    ['CLOUD_RESOURCE', 'WEBSITE_APPLICATION'],
    ['CLOUD_RESOURCE', 'SERVER'],
    ['CLOUD_RESOURCE', 'CLOUD_RESOURCE'],
  ],
  ROUTES_TO: [
    ['DOMAIN', 'WEBSITE_APPLICATION'],
    ['DOMAIN', 'SERVER'],
    ['DOMAIN', 'CLOUD_RESOURCE'],
  ],
  CONNECTED_TO: [
    ['SERVER', 'SERVER'],
    ['SERVER', 'CLOUD_RESOURCE'],
    ['CLOUD_RESOURCE', 'SERVER'],
    ['CLOUD_RESOURCE', 'CLOUD_RESOURCE'],
  ],
};

export function validateInventoryRelationshipDefinition(
  input: CreateStoredInventoryRelationshipInput,
): void {
  if (
    input.source.entityKind === input.target.entityKind &&
    input.source.entityId === input.target.entityId
  ) {
    throw new InvalidInventoryRelationshipError();
  }

  const allowed = relationshipKinds[input.relationshipType].some(
    ([sourceKind, targetKind]) =>
      sourceKind === input.source.entityKind &&
      targetKind === input.target.entityKind,
  );
  if (!allowed) {
    throw new InvalidInventoryRelationshipError();
  }
}

function toStoredRelationship(row: {
  readonly createdAt: Date;
  readonly id: string;
  readonly inventoryState: InventoryRelationship['inventoryState'];
  readonly notes: string | null;
  readonly provenance: InventoryRelationship['provenance'];
  readonly relationshipType: InfrastructureRelationshipType;
  readonly sourceEntityId: string;
  readonly sourceEntityKind: GraphEntityKind;
  readonly targetEntityId: string;
  readonly targetEntityKind: GraphEntityKind;
  readonly updatedAt: Date;
}): StoredInventoryRelationship {
  return {
    createdAt: row.createdAt,
    id: row.id,
    inventoryState: row.inventoryState,
    notes: row.notes,
    provenance: row.provenance,
    relationshipType: row.relationshipType,
    source: {
      entityId: row.sourceEntityId,
      entityKind: row.sourceEntityKind,
    },
    target: {
      entityId: row.targetEntityId,
      entityKind: row.targetEntityKind,
    },
    updatedAt: row.updatedAt,
  };
}

const storedRelationshipSelection = {
  createdAt: inventoryRelationships.createdAt,
  id: inventoryRelationships.id,
  inventoryState: inventoryRelationships.inventoryState,
  notes: inventoryRelationships.notes,
  provenance: inventoryRelationships.provenance,
  relationshipType: inventoryRelationships.relationshipType,
  sourceEntityId: relationshipSourceNode.entityId,
  sourceEntityKind: relationshipSourceNode.entityKind,
  targetEntityId: relationshipTargetNode.entityId,
  targetEntityKind: relationshipTargetNode.entityKind,
  updatedAt: inventoryRelationships.updatedAt,
};

function preciseRelationshipCursorTimestamp() {
  return sql<string>`to_char(${inventoryRelationships.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

function relationshipCursorCondition(
  cursor: InventoryRelationshipCursorPosition | undefined,
) {
  return cursor
    ? sql`(${inventoryRelationships.createdAt}, ${inventoryRelationships.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
    : undefined;
}

async function selectStoredInventoryRelationship(
  transaction: DatabaseTransaction,
  relationshipId: string,
): Promise<StoredInventoryRelationship | undefined> {
  const [row] = await transaction
    .select(storedRelationshipSelection)
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
        eq(inventoryRelationships.id, relationshipId),
      ),
    )
    .limit(1);

  return row ? toStoredRelationship(row) : undefined;
}

export async function getStoredInventoryRelationship(
  transaction: DatabaseTransaction,
  relationshipId: string,
): Promise<StoredInventoryRelationship> {
  const relationship = await selectStoredInventoryRelationship(
    transaction,
    relationshipId,
  );
  if (!relationship) {
    throw new StoredInventoryRelationshipNotFoundError();
  }
  return relationship;
}

async function enforcePrimaryStructuralRelationshipLocks(
  transaction: DatabaseTransaction,
  input: CreateStoredInventoryRelationshipInput,
): Promise<void> {
  if (
    input.relationshipType === 'GROUPS' &&
    input.source.entityKind === 'PROJECT' &&
    input.target.entityKind === 'WEBSITE_APPLICATION'
  ) {
    const [primaryProject] = await transaction
      .select({ id: websiteApplications.id })
      .from(websiteApplications)
      .where(
        and(
          eq(websiteApplications.workspaceId, currentWorkspaceId),
          eq(websiteApplications.id, input.target.entityId),
          eq(websiteApplications.projectId, input.source.entityId),
        ),
      )
      .limit(1);
    if (primaryProject) {
      throw new InventoryRelationshipSemanticConflictError();
    }
  }

  if (
    input.relationshipType === 'USES_DOMAIN' &&
    input.source.entityKind === 'WEBSITE_APPLICATION' &&
    input.target.entityKind === 'DOMAIN'
  ) {
    const [primaryDomain] = await transaction
      .select({ id: websiteApplications.id })
      .from(websiteApplications)
      .where(
        and(
          eq(websiteApplications.workspaceId, currentWorkspaceId),
          eq(websiteApplications.id, input.source.entityId),
          eq(websiteApplications.primaryDomainId, input.target.entityId),
        ),
      )
      .limit(1);
    if (primaryDomain) {
      throw new InventoryRelationshipSemanticConflictError();
    }
  }
}

export async function createStoredInventoryRelationship(
  transaction: DatabaseTransaction,
  input: CreateStoredInventoryRelationshipInput,
): Promise<StoredInventoryRelationship> {
  validateInventoryRelationshipDefinition(input);
  const source = await resolveInventoryNode(
    transaction,
    input.source.entityKind,
    input.source.entityId,
  );
  const target = await resolveInventoryNode(
    transaction,
    input.target.entityKind,
    input.target.entityId,
  );
  await enforcePrimaryStructuralRelationshipLocks(transaction, input);

  const [canonicalSource, canonicalTarget] =
    input.relationshipType === 'CONNECTED_TO' && source.nodeId > target.nodeId
      ? [target, source]
      : [source, target];
  const [created] = await transaction
    .insert(inventoryRelationships)
    .values({
      inventoryState: 'TRACKED',
      notes: input.notes,
      provenance: 'USER_MAPPED',
      relationshipType: input.relationshipType,
      sourceKind: canonicalSource.entityKind,
      sourceNodeId: canonicalSource.nodeId,
      targetKind: canonicalTarget.entityKind,
      targetNodeId: canonicalTarget.nodeId,
      workspaceId: currentWorkspaceId,
    })
    .returning({ id: inventoryRelationships.id });
  if (!created) {
    throw new Error('Inventory relationship insert returned no record');
  }
  return getStoredInventoryRelationship(transaction, created.id);
}

export async function listStoredInventoryRelationships(
  transaction: DatabaseTransaction,
  input: ListStoredInventoryRelationshipsInput,
): Promise<StoredInventoryRelationshipPage> {
  const rows = await transaction
    .select({
      ...storedRelationshipSelection,
      cursorCreatedAt: preciseRelationshipCursorTimestamp(),
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
        input.includeArchived
          ? undefined
          : eq(inventoryRelationships.inventoryState, 'TRACKED'),
        input.relationshipType
          ? eq(inventoryRelationships.relationshipType, input.relationshipType)
          : undefined,
        input.source
          ? and(
              eq(relationshipSourceNode.entityKind, input.source.entityKind),
              eq(relationshipSourceNode.entityId, input.source.entityId),
            )
          : undefined,
        input.target
          ? and(
              eq(relationshipTargetNode.entityKind, input.target.entityKind),
              eq(relationshipTargetNode.entityId, input.target.entityId),
            )
          : undefined,
        relationshipCursorCondition(input.cursor),
      ),
    )
    .orderBy(
      desc(inventoryRelationships.createdAt),
      desc(inventoryRelationships.id),
    )
    .limit(input.limit + 1);

  const hasNextPage = rows.length > input.limit;
  const pageRows = hasNextPage ? rows.slice(0, input.limit) : rows;
  const last = pageRows.at(-1);
  return {
    items: pageRows.map(toStoredRelationship),
    nextCursor:
      hasNextPage && last
        ? { createdAt: last.cursorCreatedAt, id: last.id }
        : null,
  };
}

export async function updateStoredInventoryRelationship(
  transaction: DatabaseTransaction,
  relationshipId: string,
  input: UpdateStoredInventoryRelationshipInput,
): Promise<StoredInventoryRelationship> {
  const [updated] = await transaction
    .update(inventoryRelationships)
    .set({
      ...('notes' in input ? { notes: input.notes } : {}),
      ...(input.inventoryState === undefined
        ? {}
        : { inventoryState: input.inventoryState }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(inventoryRelationships.workspaceId, currentWorkspaceId),
        eq(inventoryRelationships.id, relationshipId),
      ),
    )
    .returning({ id: inventoryRelationships.id });
  if (!updated) {
    throw new StoredInventoryRelationshipNotFoundError();
  }
  return getStoredInventoryRelationship(transaction, updated.id);
}

export async function archiveStoredInventoryRelationship(
  transaction: DatabaseTransaction,
  relationshipId: string,
): Promise<void> {
  const [archived] = await transaction
    .update(inventoryRelationships)
    .set({ inventoryState: 'ARCHIVED', updatedAt: new Date() })
    .where(
      and(
        eq(inventoryRelationships.workspaceId, currentWorkspaceId),
        eq(inventoryRelationships.id, relationshipId),
      ),
    )
    .returning({ id: inventoryRelationships.id });
  if (!archived) {
    throw new StoredInventoryRelationshipNotFoundError();
  }
}
