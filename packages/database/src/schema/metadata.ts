import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { domains, recordProvenanceEnum } from './portfolio';
import { lifecycleTimestamps } from './tenancy';

export const domainMetadataAttemptStatusEnum = pgEnum(
  'domain_metadata_attempt_status',
  ['SUCCESS', 'PARTIAL', 'FAILED'],
);

export interface DomainDnsMxRecord {
  readonly exchange: string;
  readonly priority: number;
}

export interface DomainDnsDsRecord {
  readonly algorithm: number;
  readonly digest: string;
  readonly digestType: number;
  readonly keyTag: number;
}

export type DomainDnsRecordErrors = Readonly<Record<string, string>>;

const metadataAttemptColumns = () => ({
  workspaceId: uuid('workspace_id').notNull(),
  domainId: uuid('domain_id').notNull(),

  lastAttemptStatus: domainMetadataAttemptStatusEnum(
    'last_attempt_status',
  ).notNull(),

  retrievedAt: timestamp('retrieved_at', {
    mode: 'date',
    withTimezone: true,
  }),

  lastAttemptedAt: timestamp('last_attempted_at', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),

  lastErrorCode: text('last_error_code'),

  ...lifecycleTimestamps(),
});

export const domainRdapMetadata = pgTable(
  'domain_rdap_metadata',
  {
    ...metadataAttemptColumns(),

    provenance: recordProvenanceEnum('provenance'),

    registrarName: text('registrar_name'),
    registrarIanaId: text('registrar_iana_id'),

    registeredAt: timestamp('registered_at', {
      mode: 'date',
      withTimezone: true,
    }),

    expiresAt: timestamp('expires_at', {
      mode: 'date',
      withTimezone: true,
    }),

    changedAt: timestamp('changed_at', {
      mode: 'date',
      withTimezone: true,
    }),

    statuses: text('statuses')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    nameservers: text('nameservers')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    secureDnsDelegationSigned: boolean('secure_dns_delegation_signed'),

    sourceUrl: text('source_url'),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.domainId],
      name: 'domain_rdap_metadata_pk',
    }),

    foreignKey({
      columns: [table.workspaceId, table.domainId],
      foreignColumns: [domains.workspaceId, domains.id],
      name: 'domain_rdap_metadata_domain_fk',
    }).onDelete('cascade'),

    index('domain_rdap_metadata_workspace_attempt_idx').on(
      table.workspaceId,
      table.lastAttemptedAt,
    ),

    check(
      'domain_rdap_metadata_error_code_canonical',
      sql`${table.lastErrorCode} is null or ${table.lastErrorCode} ~ '^[A-Z0-9_]{1,64}$'`,
    ),

    check(
      'domain_rdap_metadata_attempt_error_consistent',
      sql`
        (
          ${table.lastAttemptStatus} = 'SUCCESS'
          and ${table.lastErrorCode} is null
        )
        or
        (
          ${table.lastAttemptStatus} in ('PARTIAL', 'FAILED')
          and ${table.lastErrorCode} is not null
        )
      `,
    ),

    check(
      'domain_rdap_metadata_provenance_locked',
      sql`${table.provenance} = 'RDAP_RETRIEVED'`,
    ),

    check(
      'domain_rdap_metadata_registrar_name_not_blank',
      sql`${table.registrarName} is null or length(btrim(${table.registrarName})) > 0`,
    ),

    check(
      'domain_rdap_metadata_registrar_iana_id_not_blank',
      sql`${table.registrarIanaId} is null or length(btrim(${table.registrarIanaId})) > 0`,
    ),

    check(
      'domain_rdap_metadata_source_url_not_blank',
      sql`${table.sourceUrl} is null or length(btrim(${table.sourceUrl})) > 0`,
    ),
  ],
);

export const domainDnsMetadata = pgTable(
  'domain_dns_metadata',
  {
    ...metadataAttemptColumns(),

    provenance: recordProvenanceEnum('provenance'),

    aRecords: text('a_records')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    aaaaRecords: text('aaaa_records')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    cnameRecords: text('cname_records')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    mxRecords: jsonb('mx_records')
      .$type<DomainDnsMxRecord[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    nsRecords: text('ns_records')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    dsRecords: jsonb('ds_records')
      .$type<DomainDnsDsRecord[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    txtRecordCount: integer('txt_record_count')
      .default(0)
      .notNull(),

    recordErrors: jsonb('record_errors')
      .$type<DomainDnsRecordErrors>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.domainId],
      name: 'domain_dns_metadata_pk',
    }),

    foreignKey({
      columns: [table.workspaceId, table.domainId],
      foreignColumns: [domains.workspaceId, domains.id],
      name: 'domain_dns_metadata_domain_fk',
    }).onDelete('cascade'),

    index('domain_dns_metadata_workspace_attempt_idx').on(
      table.workspaceId,
      table.lastAttemptedAt,
    ),

    check(
      'domain_dns_metadata_error_code_canonical',
      sql`${table.lastErrorCode} is null or ${table.lastErrorCode} ~ '^[A-Z0-9_]{1,64}$'`,
    ),

    check(
      'domain_dns_metadata_attempt_error_consistent',
      sql`
        (
          ${table.lastAttemptStatus} = 'SUCCESS'
          and ${table.lastErrorCode} is null
        )
        or
        (
          ${table.lastAttemptStatus} in ('PARTIAL', 'FAILED')
          and ${table.lastErrorCode} is not null
        )
      `,
    ),

    check(
      'domain_dns_metadata_provenance_locked',
      sql`${table.provenance} = 'DNS_RETRIEVED'`,
    ),

    check(
      'domain_dns_metadata_txt_record_count_nonnegative',
      sql`${table.txtRecordCount} >= 0`,
    ),
  ],
);

export const domainTlsMetadata = pgTable(
  'domain_tls_metadata',
  {
    ...metadataAttemptColumns(),

    provenance: recordProvenanceEnum('provenance'),

    subjectCommonName: text('subject_common_name'),
    issuerCommonName: text('issuer_common_name'),
    issuerOrganization: text('issuer_organization'),

    subjectAltNames: text('subject_alt_names')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    validFrom: timestamp('valid_from', {
      mode: 'date',
      withTimezone: true,
    }),

    validTo: timestamp('valid_to', {
      mode: 'date',
      withTimezone: true,
    }),

    serialNumber: text('serial_number'),
    fingerprint256: text('fingerprint_256'),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.domainId],
      name: 'domain_tls_metadata_pk',
    }),

    foreignKey({
      columns: [table.workspaceId, table.domainId],
      foreignColumns: [domains.workspaceId, domains.id],
      name: 'domain_tls_metadata_domain_fk',
    }).onDelete('cascade'),

    index('domain_tls_metadata_workspace_attempt_idx').on(
      table.workspaceId,
      table.lastAttemptedAt,
    ),

    check(
      'domain_tls_metadata_error_code_canonical',
      sql`${table.lastErrorCode} is null or ${table.lastErrorCode} ~ '^[A-Z0-9_]{1,64}$'`,
    ),

    check(
      'domain_tls_metadata_attempt_error_consistent',
      sql`
        (
          ${table.lastAttemptStatus} = 'SUCCESS'
          and ${table.lastErrorCode} is null
        )
        or
        (
          ${table.lastAttemptStatus} in ('PARTIAL', 'FAILED')
          and ${table.lastErrorCode} is not null
        )
      `,
    ),

    check(
      'domain_tls_metadata_provenance_locked',
      sql`${table.provenance} = 'SSL_RETRIEVED'`,
    ),

    check(
      'domain_tls_metadata_validity_order',
      sql`${table.validFrom} is null or ${table.validTo} is null or ${table.validTo} > ${table.validFrom}`,
    ),

    check(
      'domain_tls_metadata_subject_cn_not_blank',
      sql`${table.subjectCommonName} is null or length(btrim(${table.subjectCommonName})) > 0`,
    ),

    check(
      'domain_tls_metadata_issuer_cn_not_blank',
      sql`${table.issuerCommonName} is null or length(btrim(${table.issuerCommonName})) > 0`,
    ),

    check(
      'domain_tls_metadata_issuer_org_not_blank',
      sql`${table.issuerOrganization} is null or length(btrim(${table.issuerOrganization})) > 0`,
    ),

    check(
      'domain_tls_metadata_serial_not_blank',
      sql`${table.serialNumber} is null or length(btrim(${table.serialNumber})) > 0`,
    ),

    check(
      'domain_tls_metadata_fingerprint_not_blank',
      sql`${table.fingerprint256} is null or length(btrim(${table.fingerprint256})) > 0`,
    ),
  ],
);

export type DomainRdapMetadata = typeof domainRdapMetadata.$inferSelect;
export type NewDomainRdapMetadata = typeof domainRdapMetadata.$inferInsert;

export type DomainDnsMetadata = typeof domainDnsMetadata.$inferSelect;
export type NewDomainDnsMetadata = typeof domainDnsMetadata.$inferInsert;

export type DomainTlsMetadata = typeof domainTlsMetadata.$inferSelect;
export type NewDomainTlsMetadata = typeof domainTlsMetadata.$inferInsert;
