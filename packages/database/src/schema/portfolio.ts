import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  inet,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { lifecycleTimestamps, workspaces } from './tenancy';

export const inventoryRecordStateEnum = pgEnum('inventory_record_state', [
  'TRACKED',
  'ARCHIVED',
]);

export const recordProvenanceEnum = pgEnum('record_provenance', [
  'USER_ADDED',
  'USER_MAPPED',
  'IMPORTED',
  'PROVIDER_API',
  'RDAP_RETRIEVED',
  'DNS_RETRIEVED',
  'SSL_RETRIEVED',
  'CALCULATED',
]);

export const applicationKindEnum = pgEnum('application_kind', [
  'WEBSITE',
  'WEB_APPLICATION',
  'API',
  'BACKEND_SERVICE',
  'MOBILE_APPLICATION',
  'OTHER',
]);

const portfolioRecordColumns = () => ({
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'restrict' }),
  inventoryState: inventoryRecordStateEnum('inventory_state')
    .default('TRACKED')
    .notNull(),
  provenance: recordProvenanceEnum('provenance').notNull(),
  ...lifecycleTimestamps(),
});

export const projects = pgTable(
  'projects',
  {
    ...portfolioRecordColumns(),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    description: text('description'),
  },
  (table) => [
    unique('projects_workspace_id_id_unique').on(table.workspaceId, table.id),
    uniqueIndex('projects_workspace_normalized_name_unique').on(
      table.workspaceId,
      table.normalizedName,
    ),
    check('projects_name_not_blank', sql`length(btrim(${table.name})) > 0`),
    check(
      'projects_normalized_name_matches_name',
      sql`${table.normalizedName} = lower(btrim(${table.name}))`,
    ),
  ],
);

export const emailAccounts = pgTable(
  'email_accounts',
  {
    ...portfolioRecordColumns(),
    email: text('email').notNull(),
    normalizedEmail: text('normalized_email').notNull(),
    label: text('label'),
    notes: text('notes'),
  },
  (table) => [
    unique('email_accounts_workspace_id_id_unique').on(
      table.workspaceId,
      table.id,
    ),
    uniqueIndex('email_accounts_workspace_normalized_email_unique').on(
      table.workspaceId,
      table.normalizedEmail,
    ),
    check(
      'email_accounts_email_not_blank',
      sql`length(btrim(${table.email})) > 0`,
    ),
    check(
      'email_accounts_normalized_email_not_blank',
      sql`length(btrim(${table.normalizedEmail})) > 0`,
    ),
    check(
      'email_accounts_normalized_email_matches_email',
      sql`${table.normalizedEmail} = lower(btrim(${table.email}))`,
    ),
  ],
);

export const providerAccounts = pgTable(
  'provider_accounts',
  {
    ...portfolioRecordColumns(),
    providerKey: text('provider_key').notNull(),
    label: text('label').notNull(),
    externalAccountId: text('external_account_id'),
    loginEmailAccountId: uuid('login_email_account_id'),
    notes: text('notes'),
  },
  (table) => [
    unique('provider_accounts_workspace_id_id_unique').on(
      table.workspaceId,
      table.id,
    ),
    uniqueIndex('provider_accounts_workspace_provider_external_unique')
      .on(table.workspaceId, table.providerKey, table.externalAccountId)
      .where(sql`${table.externalAccountId} is not null`),
    index('provider_accounts_workspace_provider_key_idx').on(
      table.workspaceId,
      table.providerKey,
    ),
    index('provider_accounts_workspace_login_email_idx').on(
      table.workspaceId,
      table.loginEmailAccountId,
    ),
    foreignKey({
      columns: [table.workspaceId, table.loginEmailAccountId],
      foreignColumns: [emailAccounts.workspaceId, emailAccounts.id],
      name: 'provider_accounts_workspace_login_email_fk',
    }).onDelete('restrict'),
    check(
      'provider_accounts_provider_key_canonical',
      sql`${table.providerKey} ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'`,
    ),
    check(
      'provider_accounts_label_not_blank',
      sql`length(btrim(${table.label})) > 0`,
    ),
    check(
      'provider_accounts_external_id_not_blank',
      sql`${table.externalAccountId} is null or length(btrim(${table.externalAccountId})) > 0`,
    ),
  ],
);

export const domains = pgTable(
  'domains',
  {
    ...portfolioRecordColumns(),
    domainName: text('domain_name').notNull(),
    normalizedDomainName: text('normalized_domain_name').notNull(),
    registrarProviderAccountId: uuid('registrar_provider_account_id'),
    dnsProviderAccountId: uuid('dns_provider_account_id'),
    registeredAt: timestamp('registered_at', {
      mode: 'date',
      withTimezone: true,
    }),
    expiresAt: timestamp('expires_at', {
      mode: 'date',
      withTimezone: true,
    }),
    autoRenew: boolean('auto_renew'),
    notes: text('notes'),
  },
  (table) => [
    unique('domains_workspace_id_id_unique').on(table.workspaceId, table.id),
    uniqueIndex('domains_workspace_normalized_domain_unique').on(
      table.workspaceId,
      table.normalizedDomainName,
    ),
    index('domains_workspace_registrar_provider_idx').on(
      table.workspaceId,
      table.registrarProviderAccountId,
    ),
    index('domains_workspace_dns_provider_idx').on(
      table.workspaceId,
      table.dnsProviderAccountId,
    ),
    index('domains_workspace_expires_at_idx')
      .on(table.workspaceId, table.expiresAt)
      .where(sql`${table.expiresAt} is not null`),
    foreignKey({
      columns: [table.workspaceId, table.registrarProviderAccountId],
      foreignColumns: [providerAccounts.workspaceId, providerAccounts.id],
      name: 'domains_workspace_registrar_provider_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.workspaceId, table.dnsProviderAccountId],
      foreignColumns: [providerAccounts.workspaceId, providerAccounts.id],
      name: 'domains_workspace_dns_provider_fk',
    }).onDelete('restrict'),
    check(
      'domains_domain_name_not_blank',
      sql`length(btrim(${table.domainName})) > 0`,
    ),
    check(
      'domains_normalized_domain_not_blank',
      sql`length(btrim(${table.normalizedDomainName})) > 0`,
    ),
    check(
      'domains_normalized_domain_canonical',
      sql`${table.normalizedDomainName} = lower(btrim(${table.normalizedDomainName})) and ${table.normalizedDomainName} !~ '\\s' and right(${table.normalizedDomainName}, 1) <> '.'`,
    ),
    check(
      'domains_expiry_after_registration',
      sql`${table.expiresAt} is null or ${table.registeredAt} is null or ${table.expiresAt} > ${table.registeredAt}`,
    ),
  ],
);

export const servers = pgTable(
  'servers',
  {
    ...portfolioRecordColumns(),
    name: text('name').notNull(),
    hostname: text('hostname'),
    primaryIp: inet('primary_ip'),
    serverKind: text('server_kind'),
    providerAccountId: uuid('provider_account_id'),
    region: text('region'),
    operatingSystem: text('operating_system'),
    notes: text('notes'),
  },
  (table) => [
    unique('servers_workspace_id_id_unique').on(table.workspaceId, table.id),
    index('servers_workspace_provider_account_idx').on(
      table.workspaceId,
      table.providerAccountId,
    ),
    index('servers_workspace_hostname_idx')
      .on(table.workspaceId, table.hostname)
      .where(sql`${table.hostname} is not null`),
    index('servers_workspace_primary_ip_idx')
      .on(table.workspaceId, table.primaryIp)
      .where(sql`${table.primaryIp} is not null`),
    foreignKey({
      columns: [table.workspaceId, table.providerAccountId],
      foreignColumns: [providerAccounts.workspaceId, providerAccounts.id],
      name: 'servers_workspace_provider_account_fk',
    }).onDelete('restrict'),
    check('servers_name_not_blank', sql`length(btrim(${table.name})) > 0`),
    check(
      'servers_hostname_canonical',
      sql`${table.hostname} is null or (${table.hostname} = lower(btrim(${table.hostname})) and length(btrim(${table.hostname})) > 0 and ${table.hostname} !~ '\\s' and right(${table.hostname}, 1) <> '.')`,
    ),
    check(
      'servers_server_kind_canonical',
      sql`${table.serverKind} is null or ${table.serverKind} ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'`,
    ),
    check(
      'servers_region_not_blank',
      sql`${table.region} is null or length(btrim(${table.region})) > 0`,
    ),
    check(
      'servers_operating_system_not_blank',
      sql`${table.operatingSystem} is null or length(btrim(${table.operatingSystem})) > 0`,
    ),
  ],
);

export const cloudResources = pgTable(
  'cloud_resources',
  {
    ...portfolioRecordColumns(),
    providerAccountId: uuid('provider_account_id').notNull(),
    resourceType: text('resource_type').notNull(),
    externalResourceId: text('external_resource_id'),
    name: text('name').notNull(),
    region: text('region'),
    notes: text('notes'),
  },
  (table) => [
    unique('cloud_resources_workspace_id_id_unique').on(
      table.workspaceId,
      table.id,
    ),
    uniqueIndex('cloud_resources_workspace_provider_external_unique')
      .on(
        table.workspaceId,
        table.providerAccountId,
        table.resourceType,
        table.externalResourceId,
      )
      .where(sql`${table.externalResourceId} is not null`),
    index('cloud_resources_workspace_provider_account_idx').on(
      table.workspaceId,
      table.providerAccountId,
    ),
    index('cloud_resources_workspace_resource_type_idx').on(
      table.workspaceId,
      table.resourceType,
    ),
    foreignKey({
      columns: [table.workspaceId, table.providerAccountId],
      foreignColumns: [providerAccounts.workspaceId, providerAccounts.id],
      name: 'cloud_resources_workspace_provider_account_fk',
    }).onDelete('restrict'),
    check(
      'cloud_resources_resource_type_canonical',
      sql`${table.resourceType} ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'`,
    ),
    check(
      'cloud_resources_external_id_not_blank',
      sql`${table.externalResourceId} is null or length(btrim(${table.externalResourceId})) > 0`,
    ),
    check(
      'cloud_resources_name_not_blank',
      sql`length(btrim(${table.name})) > 0`,
    ),
    check(
      'cloud_resources_region_not_blank',
      sql`${table.region} is null or length(btrim(${table.region})) > 0`,
    ),
  ],
);

export const websiteApplications = pgTable(
  'website_applications',
  {
    ...portfolioRecordColumns(),
    name: text('name').notNull(),
    kind: applicationKindEnum('kind').notNull(),
    primaryUrl: text('primary_url'),
    primaryDomainId: uuid('primary_domain_id'),
    projectId: uuid('project_id'),
    notes: text('notes'),
  },
  (table) => [
    unique('website_applications_workspace_id_id_unique').on(
      table.workspaceId,
      table.id,
    ),
    index('website_applications_workspace_kind_idx').on(
      table.workspaceId,
      table.kind,
    ),
    index('website_applications_workspace_primary_domain_idx').on(
      table.workspaceId,
      table.primaryDomainId,
    ),
    index('website_applications_workspace_project_idx').on(
      table.workspaceId,
      table.projectId,
    ),
    foreignKey({
      columns: [table.workspaceId, table.primaryDomainId],
      foreignColumns: [domains.workspaceId, domains.id],
      name: 'website_applications_workspace_primary_domain_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: 'website_applications_workspace_project_fk',
    }).onDelete('restrict'),
    check(
      'website_applications_name_not_blank',
      sql`length(btrim(${table.name})) > 0`,
    ),
    check(
      'website_applications_primary_url_not_blank',
      sql`${table.primaryUrl} is null or length(btrim(${table.primaryUrl})) > 0`,
    ),
  ],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type EmailAccount = typeof emailAccounts.$inferSelect;
export type NewEmailAccount = typeof emailAccounts.$inferInsert;
export type ProviderAccount = typeof providerAccounts.$inferSelect;
export type NewProviderAccount = typeof providerAccounts.$inferInsert;
export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type Server = typeof servers.$inferSelect;
export type NewServer = typeof servers.$inferInsert;
export type CloudResource = typeof cloudResources.$inferSelect;
export type NewCloudResource = typeof cloudResources.$inferInsert;
export type WebsiteApplication = typeof websiteApplications.$inferSelect;
export type NewWebsiteApplication = typeof websiteApplications.$inferInsert;
