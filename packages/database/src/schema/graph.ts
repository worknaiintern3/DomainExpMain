import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  inventoryRecordStateEnum,
  recordProvenanceEnum,
} from './portfolio';
import { lifecycleTimestamps, workspaces } from './tenancy';

export const graphEntityKindEnum = pgEnum('graph_entity_kind', [
  'PROJECT',
  'DOMAIN',
  'SERVER',
  'CLOUD_RESOURCE',
  'WEBSITE_APPLICATION',
]);

export const infrastructureRelationshipTypeEnum = pgEnum(
  'infrastructure_relationship_type',
  [
    'GROUPS',
    'HOSTED_ON',
    'USES_DOMAIN',
    'DEPENDS_ON',
    'ROUTES_TO',
    'CONNECTED_TO',
  ],
);

export const inventoryNodes = pgTable(
  'inventory_nodes',
  {
    nodeId: uuid('node_id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    entityKind: graphEntityKindEnum('entity_kind').notNull(),
    entityId: uuid('entity_id').notNull(),
  },
  (table) => [
    uniqueIndex('inventory_nodes_workspace_entity_unique').on(
      table.workspaceId,
      table.entityKind,
      table.entityId,
    ),
    unique('inventory_nodes_workspace_node_kind_unique').on(
      table.workspaceId,
      table.nodeId,
      table.entityKind,
    ),
  ],
);

export const inventoryRelationships = pgTable(
  'inventory_relationships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    sourceKind: graphEntityKindEnum('source_kind').notNull(),
    sourceNodeId: uuid('source_node_id').notNull(),
    relationshipType: infrastructureRelationshipTypeEnum(
      'relationship_type',
    ).notNull(),
    targetKind: graphEntityKindEnum('target_kind').notNull(),
    targetNodeId: uuid('target_node_id').notNull(),
    inventoryState: inventoryRecordStateEnum('inventory_state')
      .default('TRACKED')
      .notNull(),
    provenance: recordProvenanceEnum('provenance').notNull(),
    notes: text('notes'),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('inventory_relationships_workspace_id_id_unique').on(
      table.workspaceId,
      table.id,
    ),
    unique(
      'inventory_relationships_workspace_canonical_edge_unique',
    ).on(
      table.workspaceId,
      table.sourceKind,
      table.sourceNodeId,
      table.relationshipType,
      table.targetKind,
      table.targetNodeId,
    ),
    foreignKey({
      columns: [table.workspaceId, table.sourceNodeId, table.sourceKind],
      foreignColumns: [
        inventoryNodes.workspaceId,
        inventoryNodes.nodeId,
        inventoryNodes.entityKind,
      ],
      name: 'inventory_relationships_workspace_source_node_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.workspaceId, table.targetNodeId, table.targetKind],
      foreignColumns: [
        inventoryNodes.workspaceId,
        inventoryNodes.nodeId,
        inventoryNodes.entityKind,
      ],
      name: 'inventory_relationships_workspace_target_node_fk',
    }).onDelete('cascade'),
    index('inventory_relationships_active_outbound_idx')
      .on(
        table.workspaceId,
        table.sourceKind,
        table.sourceNodeId,
        table.relationshipType,
      )
      .where(sql`${table.inventoryState} = 'TRACKED'`),
    index('inventory_relationships_active_inbound_idx')
      .on(
        table.workspaceId,
        table.targetKind,
        table.targetNodeId,
        table.relationshipType,
      )
      .where(sql`${table.inventoryState} = 'TRACKED'`),
    check(
      'inventory_relationships_kind_matrix',
      sql`
        (
          ${table.relationshipType} = 'GROUPS'
          and ${table.sourceKind} = 'PROJECT'
          and ${table.targetKind} in (
            'DOMAIN', 'SERVER', 'CLOUD_RESOURCE', 'WEBSITE_APPLICATION'
          )
        )
        or (
          ${table.relationshipType} = 'HOSTED_ON'
          and ${table.sourceKind} = 'WEBSITE_APPLICATION'
          and ${table.targetKind} in ('SERVER', 'CLOUD_RESOURCE')
        )
        or (
          ${table.relationshipType} = 'USES_DOMAIN'
          and ${table.sourceKind} = 'WEBSITE_APPLICATION'
          and ${table.targetKind} = 'DOMAIN'
        )
        or (
          ${table.relationshipType} = 'DEPENDS_ON'
          and ${table.sourceKind} in (
            'WEBSITE_APPLICATION', 'SERVER', 'CLOUD_RESOURCE'
          )
          and ${table.targetKind} in (
            'DOMAIN', 'WEBSITE_APPLICATION', 'SERVER', 'CLOUD_RESOURCE'
          )
        )
        or (
          ${table.relationshipType} = 'ROUTES_TO'
          and ${table.sourceKind} = 'DOMAIN'
          and ${table.targetKind} in (
            'WEBSITE_APPLICATION', 'SERVER', 'CLOUD_RESOURCE'
          )
        )
        or (
          ${table.relationshipType} = 'CONNECTED_TO'
          and ${table.sourceKind} in ('SERVER', 'CLOUD_RESOURCE')
          and ${table.targetKind} in ('SERVER', 'CLOUD_RESOURCE')
        )
      `,
    ),
    check(
      'inventory_relationships_no_self_edge',
      sql`${table.sourceNodeId} <> ${table.targetNodeId}`,
    ),
    check(
      'inventory_relationships_connected_canonical_order',
      sql`${table.relationshipType} <> 'CONNECTED_TO' or ${table.sourceNodeId} < ${table.targetNodeId}`,
    ),
    check(
      'inventory_relationships_allowed_provenance',
      sql`${table.provenance} in ('USER_MAPPED', 'IMPORTED', 'PROVIDER_API', 'DNS_RETRIEVED', 'CALCULATED')`,
    ),
  ],
);

export type InventoryNode = typeof inventoryNodes.$inferSelect;
export type NewInventoryNode = typeof inventoryNodes.$inferInsert;
export type InventoryRelationship = typeof inventoryRelationships.$inferSelect;
export type NewInventoryRelationship =
  typeof inventoryRelationships.$inferInsert;
