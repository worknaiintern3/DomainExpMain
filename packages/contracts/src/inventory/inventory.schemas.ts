import { z } from 'zod';

export const InventoryRecordStateSchema = z.enum(['TRACKED', 'ARCHIVED']);
export const InventoryRecordProvenanceSchema = z.enum([
  'USER_ADDED',
  'USER_MAPPED',
  'IMPORTED',
  'PROVIDER_API',
  'RDAP_RETRIEVED',
  'DNS_RETRIEVED',
  'SSL_RETRIEVED',
  'CALCULATED',
]);
export const ApplicationKindSchema = z.enum([
  'WEBSITE',
  'WEB_APPLICATION',
  'API',
  'BACKEND_SERVICE',
  'MOBILE_APPLICATION',
  'OTHER',
]);

const ShortTextSchema = z.string().trim().min(1).max(255);
const OptionalShortTextSchema = z.string().trim().min(1).max(255).nullable();
const NotesSchema = z.string().trim().max(10_000).nullable();
const UuidReferenceSchema = z.uuid().nullable();
const DateTimeInputSchema = z.iso.datetime({ offset: true }).nullable();
const CanonicalKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u);

function hasAtLeastOneProperty(value: object): boolean {
  return Object.keys(value).length > 0;
}

export const InventoryIdParamsSchema = z
  .object({ id: z.uuid() })
  .strict();

const IncludeArchivedSchema = z
  .union([
    z.literal('true').transform(() => true),
    z.literal('false').transform(() => false),
    z.boolean(),
  ])
  .default(false);

export const InventoryListQuerySchema = z
  .object({
    cursor: z.string().min(1).max(1024).optional(),
    includeArchived: IncludeArchivedSchema,
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

const InventoryMetadataShape = {
  id: z.uuid(),
  inventoryState: InventoryRecordStateSchema,
  provenance: InventoryRecordProvenanceSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
};

export const CreateEmailAccountRequestSchema = z
  .object({
    email: z.string().trim().max(320).pipe(z.email()),
    label: OptionalShortTextSchema.optional(),
    notes: NotesSchema.optional(),
  })
  .strict();
export const UpdateEmailAccountRequestSchema = z
  .object({
    email: z.string().trim().max(320).pipe(z.email()).optional(),
    inventoryState: InventoryRecordStateSchema.optional(),
    label: OptionalShortTextSchema.optional(),
    notes: NotesSchema.optional(),
  })
  .strict()
  .refine(hasAtLeastOneProperty, { message: 'At least one field is required' });
export const EmailAccountResponseSchema = z
  .object({
    ...InventoryMetadataShape,
    email: z.email(),
    label: z.string().nullable(),
    notes: z.string().nullable(),
  })
  .strict();

export const CreateProviderAccountRequestSchema = z
  .object({
    externalAccountId: OptionalShortTextSchema.optional(),
    label: ShortTextSchema,
    loginEmailAccountId: UuidReferenceSchema.optional(),
    notes: NotesSchema.optional(),
    providerKey: CanonicalKeySchema,
  })
  .strict();
export const UpdateProviderAccountRequestSchema = z
  .object({
    externalAccountId: OptionalShortTextSchema.optional(),
    inventoryState: InventoryRecordStateSchema.optional(),
    label: ShortTextSchema.optional(),
    loginEmailAccountId: UuidReferenceSchema.optional(),
    notes: NotesSchema.optional(),
    providerKey: CanonicalKeySchema.optional(),
  })
  .strict()
  .refine(hasAtLeastOneProperty, { message: 'At least one field is required' });
export const ProviderAccountResponseSchema = z
  .object({
    ...InventoryMetadataShape,
    externalAccountId: z.string().nullable(),
    label: z.string(),
    loginEmailAccountId: z.uuid().nullable(),
    notes: z.string().nullable(),
    providerKey: z.string(),
  })
  .strict();

export const CreateProjectRequestSchema = z
  .object({
    description: NotesSchema.optional(),
    name: ShortTextSchema,
  })
  .strict();
export const UpdateProjectRequestSchema = z
  .object({
    description: NotesSchema.optional(),
    inventoryState: InventoryRecordStateSchema.optional(),
    name: ShortTextSchema.optional(),
  })
  .strict()
  .refine(hasAtLeastOneProperty, { message: 'At least one field is required' });
export const ProjectResponseSchema = z
  .object({
    ...InventoryMetadataShape,
    description: z.string().nullable(),
    name: z.string(),
  })
  .strict();

export const CreateDomainRequestSchema = z
  .object({
    autoRenew: z.boolean().nullable().optional(),
    dnsProviderAccountId: UuidReferenceSchema.optional(),
    domainName: z.string().trim().min(1).max(1024),
    expiresAt: DateTimeInputSchema.optional(),
    notes: NotesSchema.optional(),
    registeredAt: DateTimeInputSchema.optional(),
    registrarProviderAccountId: UuidReferenceSchema.optional(),
  })
  .strict();
export const UpdateDomainRequestSchema = z
  .object({
    autoRenew: z.boolean().nullable().optional(),
    dnsProviderAccountId: UuidReferenceSchema.optional(),
    domainName: z.string().trim().min(1).max(1024).optional(),
    expiresAt: DateTimeInputSchema.optional(),
    inventoryState: InventoryRecordStateSchema.optional(),
    notes: NotesSchema.optional(),
    registeredAt: DateTimeInputSchema.optional(),
    registrarProviderAccountId: UuidReferenceSchema.optional(),
  })
  .strict()
  .refine(hasAtLeastOneProperty, { message: 'At least one field is required' });
export const DomainResponseSchema = z
  .object({
    ...InventoryMetadataShape,
    autoRenew: z.boolean().nullable(),
    dnsProviderAccountId: z.uuid().nullable(),
    domainName: z.string(),
    expiresAt: z.iso.datetime({ offset: true }).nullable(),
    notes: z.string().nullable(),
    registeredAt: z.iso.datetime({ offset: true }).nullable(),
    registrarProviderAccountId: z.uuid().nullable(),
  })
  .strict();

export const CreateServerRequestSchema = z
  .object({
    hostname: OptionalShortTextSchema.optional(),
    name: ShortTextSchema,
    notes: NotesSchema.optional(),
    operatingSystem: OptionalShortTextSchema.optional(),
    primaryIp: z.string().trim().min(1).max(45).nullable().optional(),
    providerAccountId: UuidReferenceSchema.optional(),
    region: OptionalShortTextSchema.optional(),
    serverKind: CanonicalKeySchema.nullable().optional(),
  })
  .strict();
export const UpdateServerRequestSchema = z
  .object({
    hostname: OptionalShortTextSchema.optional(),
    inventoryState: InventoryRecordStateSchema.optional(),
    name: ShortTextSchema.optional(),
    notes: NotesSchema.optional(),
    operatingSystem: OptionalShortTextSchema.optional(),
    primaryIp: z.string().trim().min(1).max(45).nullable().optional(),
    providerAccountId: UuidReferenceSchema.optional(),
    region: OptionalShortTextSchema.optional(),
    serverKind: CanonicalKeySchema.nullable().optional(),
  })
  .strict()
  .refine(hasAtLeastOneProperty, { message: 'At least one field is required' });
export const ServerResponseSchema = z
  .object({
    ...InventoryMetadataShape,
    hostname: z.string().nullable(),
    name: z.string(),
    notes: z.string().nullable(),
    operatingSystem: z.string().nullable(),
    primaryIp: z.string().nullable(),
    providerAccountId: z.uuid().nullable(),
    region: z.string().nullable(),
    serverKind: z.string().nullable(),
  })
  .strict();

export const CreateCloudResourceRequestSchema = z
  .object({
    externalResourceId: OptionalShortTextSchema.optional(),
    name: ShortTextSchema,
    notes: NotesSchema.optional(),
    providerAccountId: z.uuid(),
    region: OptionalShortTextSchema.optional(),
    resourceType: CanonicalKeySchema,
  })
  .strict();
export const UpdateCloudResourceRequestSchema = z
  .object({
    externalResourceId: OptionalShortTextSchema.optional(),
    inventoryState: InventoryRecordStateSchema.optional(),
    name: ShortTextSchema.optional(),
    notes: NotesSchema.optional(),
    providerAccountId: z.uuid().optional(),
    region: OptionalShortTextSchema.optional(),
    resourceType: CanonicalKeySchema.optional(),
  })
  .strict()
  .refine(hasAtLeastOneProperty, { message: 'At least one field is required' });
export const CloudResourceResponseSchema = z
  .object({
    ...InventoryMetadataShape,
    externalResourceId: z.string().nullable(),
    name: z.string(),
    notes: z.string().nullable(),
    providerAccountId: z.uuid(),
    region: z.string().nullable(),
    resourceType: z.string(),
  })
  .strict();

export const CreateApplicationRequestSchema = z
  .object({
    kind: ApplicationKindSchema,
    name: ShortTextSchema,
    notes: NotesSchema.optional(),
    primaryDomainId: UuidReferenceSchema.optional(),
    primaryUrl: z.url().nullable().optional(),
    projectId: UuidReferenceSchema.optional(),
  })
  .strict();
export const UpdateApplicationRequestSchema = z
  .object({
    inventoryState: InventoryRecordStateSchema.optional(),
    kind: ApplicationKindSchema.optional(),
    name: ShortTextSchema.optional(),
    notes: NotesSchema.optional(),
    primaryDomainId: UuidReferenceSchema.optional(),
    primaryUrl: z.url().nullable().optional(),
    projectId: UuidReferenceSchema.optional(),
  })
  .strict()
  .refine(hasAtLeastOneProperty, { message: 'At least one field is required' });
export const ApplicationResponseSchema = z
  .object({
    ...InventoryMetadataShape,
    kind: ApplicationKindSchema,
    name: z.string(),
    notes: z.string().nullable(),
    primaryDomainId: z.uuid().nullable(),
    primaryUrl: z.string().nullable(),
    projectId: z.uuid().nullable(),
  })
  .strict();

function collectionSchema<T extends z.ZodType>(itemSchema: T) {
  return z
    .object({
      items: z.array(itemSchema),
      nextCursor: z.string().nullable(),
    })
    .strict();
}

export const EmailAccountCollectionResponseSchema = collectionSchema(
  EmailAccountResponseSchema,
);
export const ProviderAccountCollectionResponseSchema = collectionSchema(
  ProviderAccountResponseSchema,
);
export const ProjectCollectionResponseSchema = collectionSchema(
  ProjectResponseSchema,
);
export const DomainCollectionResponseSchema = collectionSchema(
  DomainResponseSchema,
);
export const ServerCollectionResponseSchema = collectionSchema(
  ServerResponseSchema,
);
export const CloudResourceCollectionResponseSchema = collectionSchema(
  CloudResourceResponseSchema,
);
export const ApplicationCollectionResponseSchema = collectionSchema(
  ApplicationResponseSchema,
);

export type InventoryListQuery = z.infer<typeof InventoryListQuerySchema>;
export type CreateEmailAccountRequest = z.infer<
  typeof CreateEmailAccountRequestSchema
>;
export type UpdateEmailAccountRequest = z.infer<
  typeof UpdateEmailAccountRequestSchema
>;
export type EmailAccountResponse = z.infer<typeof EmailAccountResponseSchema>;
export type CreateProviderAccountRequest = z.infer<
  typeof CreateProviderAccountRequestSchema
>;
export type UpdateProviderAccountRequest = z.infer<
  typeof UpdateProviderAccountRequestSchema
>;
export type ProviderAccountResponse = z.infer<
  typeof ProviderAccountResponseSchema
>;
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type CreateDomainRequest = z.infer<typeof CreateDomainRequestSchema>;
export type UpdateDomainRequest = z.infer<typeof UpdateDomainRequestSchema>;
export type DomainResponse = z.infer<typeof DomainResponseSchema>;
export type CreateServerRequest = z.infer<typeof CreateServerRequestSchema>;
export type UpdateServerRequest = z.infer<typeof UpdateServerRequestSchema>;
export type ServerResponse = z.infer<typeof ServerResponseSchema>;
export type CreateCloudResourceRequest = z.infer<
  typeof CreateCloudResourceRequestSchema
>;
export type UpdateCloudResourceRequest = z.infer<
  typeof UpdateCloudResourceRequestSchema
>;
export type CloudResourceResponse = z.infer<
  typeof CloudResourceResponseSchema
>;
export type CreateApplicationRequest = z.infer<
  typeof CreateApplicationRequestSchema
>;
export type UpdateApplicationRequest = z.infer<
  typeof UpdateApplicationRequestSchema
>;
export type ApplicationResponse = z.infer<typeof ApplicationResponseSchema>;
