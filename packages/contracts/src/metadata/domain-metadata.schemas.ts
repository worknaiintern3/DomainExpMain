import { z } from 'zod';

export const DomainMetadataSourceSchema = z.enum(['rdap', 'dns', 'tls']);
export const DomainMetadataAttemptStatusSchema = z.enum([
  'SUCCESS',
  'PARTIAL',
  'FAILED',
]);

const NullableDateTimeSchema = z.iso.datetime({ offset: true }).nullable();
const NullableErrorCodeSchema = z
  .string()
  .regex(/^[A-Z0-9_]{1,64}$/u)
  .nullable();
const MetadataAttemptShape = {
  lastAttemptStatus: DomainMetadataAttemptStatusSchema,
  lastAttemptedAt: z.iso.datetime({ offset: true }),
  lastErrorCode: NullableErrorCodeSchema,
  provenance: z.enum([
    'RDAP_RETRIEVED',
    'DNS_RETRIEVED',
    'SSL_RETRIEVED',
  ]).nullable(),
  retrievedAt: NullableDateTimeSchema,
};

export const DomainRdapMetadataSchema = z
  .object({
    ...MetadataAttemptShape,
    changedAt: NullableDateTimeSchema,
    expiresAt: NullableDateTimeSchema,
    nameservers: z.array(z.string()),
    registeredAt: NullableDateTimeSchema,
    registrarIanaId: z.string().nullable(),
    registrarName: z.string().nullable(),
    secureDnsDelegationSigned: z.boolean().nullable(),
    sourceUrl: z.url().nullable(),
    statuses: z.array(z.string()),
  })
  .strict();

export const DomainDnsMxRecordSchema = z
  .object({ exchange: z.string(), priority: z.number().int().nonnegative() })
  .strict();
export const DomainDnsDsRecordSchema = z
  .object({
    algorithm: z.number().int().nonnegative(),
    digest: z.string(),
    digestType: z.number().int().nonnegative(),
    keyTag: z.number().int().nonnegative(),
  })
  .strict();
export const DomainDnsMetadataSchema = z
  .object({
    ...MetadataAttemptShape,
    aRecords: z.array(z.string()),
    aaaaRecords: z.array(z.string()),
    cnameRecords: z.array(z.string()),
    dsRecords: z.array(DomainDnsDsRecordSchema),
    mxRecords: z.array(DomainDnsMxRecordSchema),
    nsRecords: z.array(z.string()),
    recordErrors: z.record(z.string(), z.string().regex(/^[A-Z0-9_]{1,64}$/u)),
    txtRecordCount: z.number().int().nonnegative(),
  })
  .strict();

export const DomainTlsMetadataSchema = z
  .object({
    ...MetadataAttemptShape,
    fingerprint256: z.string().nullable(),
    issuerCommonName: z.string().nullable(),
    issuerOrganization: z.string().nullable(),
    serialNumber: z.string().nullable(),
    subjectAltNames: z.array(z.string()),
    subjectCommonName: z.string().nullable(),
    validFrom: NullableDateTimeSchema,
    validTo: NullableDateTimeSchema,
  })
  .strict();

export const DomainMetadataResponseSchema = z
  .object({
    canRefresh: z.boolean(),
    dns: DomainDnsMetadataSchema.nullable(),
    domainId: z.uuid(),
    rdap: DomainRdapMetadataSchema.nullable(),
    tls: DomainTlsMetadataSchema.nullable(),
  })
  .strict();

export const RefreshDomainMetadataRequestSchema = z
  .object({
    sources: z
      .array(DomainMetadataSourceSchema)
      .min(1)
      .max(3)
      .transform((sources) => [...new Set(sources)])
      .optional(),
  })
  .strict();

export const DomainMetadataRefreshSourceResultSchema = z
  .object({
    errorCode: NullableErrorCodeSchema,
    status: DomainMetadataAttemptStatusSchema,
  })
  .strict();

export const RefreshDomainMetadataResponseSchema = z
  .object({
    domainId: z.uuid(),
    metadata: DomainMetadataResponseSchema,
    results: z
      .object({
        dns: DomainMetadataRefreshSourceResultSchema.optional(),
        rdap: DomainMetadataRefreshSourceResultSchema.optional(),
        tls: DomainMetadataRefreshSourceResultSchema.optional(),
      })
      .strict(),
  })
  .strict();

export type DomainMetadataSource = z.infer<typeof DomainMetadataSourceSchema>;
export type DomainMetadataAttemptStatus = z.infer<typeof DomainMetadataAttemptStatusSchema>;
export type DomainRdapMetadataResponse = z.infer<typeof DomainRdapMetadataSchema>;
export type DomainDnsMetadataResponse = z.infer<typeof DomainDnsMetadataSchema>;
export type DomainTlsMetadataResponse = z.infer<typeof DomainTlsMetadataSchema>;
export type DomainMetadataResponse = z.infer<typeof DomainMetadataResponseSchema>;
export type RefreshDomainMetadataRequest = z.infer<typeof RefreshDomainMetadataRequestSchema>;
export type RefreshDomainMetadataResponse = z.infer<typeof RefreshDomainMetadataResponseSchema>;
