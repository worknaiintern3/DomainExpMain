import { z } from 'zod';

import {
  InventoryRecordProvenanceSchema,
  InventoryRecordStateSchema,
} from './inventory.schemas';
import {
  InventoryEntityReferenceSchema,
  InventoryGraphEntityKindSchema,
  InventoryRelationshipTypeSchema,
} from './relationship.schemas';

const IncludeArchivedSchema = z
  .union([
    z.literal('true').transform(() => true),
    z.literal('false').transform(() => false),
    z.boolean(),
  ])
  .default(false);

export const InventoryGraphReadQuerySchema = z
  .object({ includeArchived: IncludeArchivedSchema })
  .strict();

export const InventoryGraphEntityParamsSchema = z
  .object({
    entityId: z.uuid(),
    entityKind: InventoryGraphEntityKindSchema,
  })
  .strict();

export const InventoryDependencySourceParamsSchema = z
  .object({
    entityId: z.uuid(),
    entityKind: z.enum(['WEBSITE_APPLICATION', 'SERVER', 'CLOUD_RESOURCE']),
  })
  .strict();

export const InventoryDependencyTargetParamsSchema = z
  .object({
    entityId: z.uuid(),
    entityKind: z.enum([
      'DOMAIN',
      'WEBSITE_APPLICATION',
      'SERVER',
      'CLOUD_RESOURCE',
    ]),
  })
  .strict();

export const InventoryConnectionParamsSchema = z
  .object({
    entityId: z.uuid(),
    entityKind: z.enum(['SERVER', 'CLOUD_RESOURCE']),
  })
  .strict();

export const InventoryAssociationSourceSchema = z.enum([
  'PRIMARY_STRUCTURAL',
  'FLEXIBLE_RELATIONSHIP',
]);

export const InventoryAssociatedEntityResponseSchema = z
  .object({
    associationSources: z.array(InventoryAssociationSourceSchema).min(1),
    entityId: z.uuid(),
    entityKind: InventoryGraphEntityKindSchema,
  })
  .strict();

export const InventoryAssociatedEntityCollectionResponseSchema = z
  .object({ items: z.array(InventoryAssociatedEntityResponseSchema) })
  .strict();

export const InventoryEntityReferenceCollectionResponseSchema = z
  .object({ items: z.array(InventoryEntityReferenceSchema) })
  .strict();

export const InventoryImmediateRelationshipResponseSchema = z
  .object({
    direction: z.enum(['OUTBOUND', 'INBOUND']),
    entity: InventoryEntityReferenceSchema,
    id: z.uuid(),
    inventoryState: InventoryRecordStateSchema,
    provenance: InventoryRecordProvenanceSchema,
    relationshipType: InventoryRelationshipTypeSchema,
  })
  .strict();

export const InventoryImmediateRelationshipCollectionResponseSchema = z
  .object({ items: z.array(InventoryImmediateRelationshipResponseSchema) })
  .strict();

export type InventoryGraphReadQuery = z.infer<
  typeof InventoryGraphReadQuerySchema
>;
export type InventoryGraphEntityParams = z.infer<
  typeof InventoryGraphEntityParamsSchema
>;
export type InventoryDependencySourceParams = z.infer<
  typeof InventoryDependencySourceParamsSchema
>;
export type InventoryDependencyTargetParams = z.infer<
  typeof InventoryDependencyTargetParamsSchema
>;
export type InventoryConnectionParams = z.infer<
  typeof InventoryConnectionParamsSchema
>;
export type InventoryAssociatedEntityResponse = z.infer<
  typeof InventoryAssociatedEntityResponseSchema
>;
export type InventoryImmediateRelationshipResponse = z.infer<
  typeof InventoryImmediateRelationshipResponseSchema
>;
