import { z } from 'zod';

import {
  InventoryRecordProvenanceSchema,
  InventoryRecordStateSchema,
} from './inventory.schemas';

export const InventoryGraphEntityKindSchema = z.enum([
  'PROJECT',
  'DOMAIN',
  'SERVER',
  'CLOUD_RESOURCE',
  'WEBSITE_APPLICATION',
]);

export const InventoryRelationshipTypeSchema = z.enum([
  'GROUPS',
  'HOSTED_ON',
  'USES_DOMAIN',
  'DEPENDS_ON',
  'ROUTES_TO',
  'CONNECTED_TO',
]);

export const InventoryEntityReferenceSchema = z
  .object({
    entityId: z.uuid(),
    entityKind: InventoryGraphEntityKindSchema,
  })
  .strict();

const RelationshipNotesSchema = z.string().trim().max(10_000).nullable();
const IncludeArchivedSchema = z
  .union([
    z.literal('true').transform(() => true),
    z.literal('false').transform(() => false),
    z.boolean(),
  ])
  .default(false);

export const CreateInventoryRelationshipRequestSchema = z
  .object({
    notes: RelationshipNotesSchema.optional(),
    relationshipType: InventoryRelationshipTypeSchema,
    source: InventoryEntityReferenceSchema,
    target: InventoryEntityReferenceSchema,
  })
  .strict();

export const UpdateInventoryRelationshipRequestSchema = z
  .object({
    inventoryState: InventoryRecordStateSchema.optional(),
    notes: RelationshipNotesSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const InventoryRelationshipListQuerySchema = z
  .object({
    cursor: z.string().min(1).max(1024).optional(),
    includeArchived: IncludeArchivedSchema,
    limit: z.coerce.number().int().min(1).max(100).default(50),
    relationshipType: InventoryRelationshipTypeSchema.optional(),
    sourceEntityId: z.uuid().optional(),
    sourceEntityKind: InventoryGraphEntityKindSchema.optional(),
    targetEntityId: z.uuid().optional(),
    targetEntityKind: InventoryGraphEntityKindSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.sourceEntityId === undefined) !== (value.sourceEntityKind === undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'Source entity kind and ID must be supplied together',
      });
    }
    if ((value.targetEntityId === undefined) !== (value.targetEntityKind === undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'Target entity kind and ID must be supplied together',
      });
    }
  });

export const InventoryRelationshipResponseSchema = z
  .object({
    createdAt: z.iso.datetime({ offset: true }),
    id: z.uuid(),
    inventoryState: InventoryRecordStateSchema,
    notes: z.string().nullable(),
    provenance: InventoryRecordProvenanceSchema,
    relationshipType: InventoryRelationshipTypeSchema,
    source: InventoryEntityReferenceSchema,
    target: InventoryEntityReferenceSchema,
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const InventoryRelationshipCollectionResponseSchema = z
  .object({
    items: z.array(InventoryRelationshipResponseSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();

export type InventoryGraphEntityKind = z.infer<
  typeof InventoryGraphEntityKindSchema
>;
export type InventoryRelationshipType = z.infer<
  typeof InventoryRelationshipTypeSchema
>;
export type InventoryEntityReference = z.infer<
  typeof InventoryEntityReferenceSchema
>;
export type CreateInventoryRelationshipRequest = z.infer<
  typeof CreateInventoryRelationshipRequestSchema
>;
export type UpdateInventoryRelationshipRequest = z.infer<
  typeof UpdateInventoryRelationshipRequestSchema
>;
export type InventoryRelationshipListQuery = z.infer<
  typeof InventoryRelationshipListQuerySchema
>;
export type InventoryRelationshipResponse = z.infer<
  typeof InventoryRelationshipResponseSchema
>;
