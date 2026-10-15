import type { Db } from 'mongodb';

export const MONGO_COLLECTIONS = {
  USERS: 'users',
  WORKSPACES: 'workspaces',
  WORKSPACE_MEMBERS: 'workspaceMembers',
  PASSWORD_CREDENTIALS: 'passwordCredentials',
  SESSIONS: 'sessions',
  OAUTH_IDENTITIES: 'oauthIdentities',
  OAUTH_TRANSACTIONS: 'oauthTransactions',
  DOMAINS: 'domains',
  SERVERS: 'servers',
  PROVIDER_ACCOUNTS: 'providerAccounts',
  EMAIL_ACCOUNTS: 'emailAccounts',
  CLOUD_RESOURCES: 'cloudResources',
  PROJECTS: 'projects',
  WEBSITE_APPLICATIONS: 'websiteApplications',
  INVENTORY_NODES: 'inventoryNodes',
  INVENTORY_RELATIONSHIPS: 'inventoryRelationships',
  DOMAIN_DNS_METADATA: 'domainDnsMetadata',
  DOMAIN_RDAP_METADATA: 'domainRdapMetadata',
  DOMAIN_TLS_METADATA: 'domainTlsMetadata',
  WHOIS_RECORDS: 'whoisRecords',
  PROVIDER_CONNECTIONS: 'providerConnections',
  PROVIDER_SYNC_RUNS: 'providerSyncRuns',
  PROVIDER_RESOURCE_LINKS: 'providerResourceLinks',
  MONITORING_TARGETS: 'monitoringTargets',
  MONITORING_RUNS: 'monitoringRuns',
  ALERT_RULES: 'alertRules',
  ALERT_EVENTS: 'alertEvents',
  MOBILE_APP_CONFIG: 'mobileAppConfig',
  MOBILE_APP_VERSIONS: 'mobileAppVersions',
  MOBILE_HOME_CONFIG: 'mobileHomeConfig',
  MOBILE_NAVIGATION_CONFIG: 'mobileNavigationConfig',
  MOBILE_FEATURE_FLAGS: 'mobileFeatureFlags',
  MOBILE_ANNOUNCEMENTS: 'mobileAnnouncements',
  MOBILE_AUDIT_LOGS: 'mobileAuditLogs',
  GOOGLE_PLAY_CONNECTIONS: 'googlePlayConnections',
  GOOGLE_PLAY_OAUTH_STATES: 'googlePlayOauthStates',
  NOTIFICATION_DEVICE_TOKENS: 'notificationDeviceTokens',
  NOTIFICATION_PREFERENCES: 'notificationPreferences',
  NOTIFICATION_HISTORY: 'notificationHistory',
  ASSET_EXPIRIES: 'assetExpiries',
  SCHEDULER_LOCKS: 'schedulerLocks',
} as const;

export async function ensureMongoIndexes(db: Db): Promise<void> {
  // Users
  await db.collection(MONGO_COLLECTIONS.USERS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'users_id_unique' },
    { key: { normalizedEmail: 1 }, unique: true, name: 'users_normalized_email_unique' },
    { key: { email: 1 }, name: 'users_email_idx' },
  ]);

  // Workspaces
  await db.collection(MONGO_COLLECTIONS.WORKSPACES).createIndexes([
    { key: { id: 1 }, unique: true, name: 'workspaces_id_unique' },
    { key: { slug: 1 }, unique: true, name: 'workspaces_slug_unique' },
  ]);

  // Workspace Members
  await db.collection(MONGO_COLLECTIONS.WORKSPACE_MEMBERS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'workspace_members_id_unique' },
    {
      key: { workspaceId: 1, userId: 1 },
      unique: true,
      name: 'workspace_members_workspace_user_unique',
    },
    { key: { userId: 1 }, name: 'workspace_members_user_id_idx' },
  ]);

  // Password Credentials
  await db.collection(MONGO_COLLECTIONS.PASSWORD_CREDENTIALS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'password_credentials_id_unique' },
    { key: { userId: 1 }, unique: true, name: 'password_credentials_user_id_unique' },
  ]);

  // Sessions
  await db.collection(MONGO_COLLECTIONS.SESSIONS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'sessions_id_unique' },
    {
      key: { refreshTokenHash: 1 },
      unique: true,
      name: 'sessions_refresh_token_hash_unique',
    },
    { key: { userId: 1 }, name: 'sessions_user_id_idx' },
    { key: { expiresAt: 1 }, name: 'sessions_expires_at_idx' },
  ]);

  // OAuth Identities
  await db.collection(MONGO_COLLECTIONS.OAUTH_IDENTITIES).createIndexes([
    { key: { id: 1 }, unique: true, name: 'oauth_identities_id_unique' },
    {
      key: { provider: 1, providerSubject: 1 },
      unique: true,
      name: 'oauth_identities_provider_subject_unique',
    },
    { key: { userId: 1 }, name: 'oauth_identities_user_id_idx' },
  ]);

  // OAuth Transactions
  await db.collection(MONGO_COLLECTIONS.OAUTH_TRANSACTIONS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'oauth_transactions_id_unique' },
    { key: { state: 1 }, unique: true, name: 'oauth_transactions_state_unique' },
  ]);

  // Domains
  await db.collection(MONGO_COLLECTIONS.DOMAINS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'domains_id_unique' },
    {
      key: { workspaceId: 1, punycode: 1 },
      unique: true,
      name: 'domains_workspace_punycode_unique',
    },
    { key: { workspaceId: 1, createdAt: -1 }, name: 'domains_workspace_created_idx' },
    { key: { workspaceId: 1, inventoryState: 1, createdAt: -1 }, name: 'domains_workspace_state_created_idx' },
  ]);

  // Servers
  await db.collection(MONGO_COLLECTIONS.SERVERS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'servers_id_unique' },
    { key: { workspaceId: 1, createdAt: -1 }, name: 'servers_workspace_created_idx' },
    { key: { workspaceId: 1, inventoryState: 1, createdAt: -1 }, name: 'servers_workspace_state_created_idx' },
  ]);

  // Provider Accounts
  await db.collection(MONGO_COLLECTIONS.PROVIDER_ACCOUNTS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'provider_accounts_id_unique' },
    {
      key: { workspaceId: 1, createdAt: -1 },
      name: 'provider_accounts_workspace_created_idx',
    },
  ]);

  // Email Accounts
  await db.collection(MONGO_COLLECTIONS.EMAIL_ACCOUNTS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'email_accounts_id_unique' },
    {
      key: { workspaceId: 1, createdAt: -1 },
      name: 'email_accounts_workspace_created_idx',
    },
  ]);

  // Cloud Resources
  await db.collection(MONGO_COLLECTIONS.CLOUD_RESOURCES).createIndexes([
    { key: { id: 1 }, unique: true, name: 'cloud_resources_id_unique' },
    {
      key: { workspaceId: 1, createdAt: -1 },
      name: 'cloud_resources_workspace_created_idx',
    },
  ]);

  // Projects
  await db.collection(MONGO_COLLECTIONS.PROJECTS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'projects_id_unique' },
    { key: { workspaceId: 1, createdAt: -1 }, name: 'projects_workspace_created_idx' },
  ]);

  // Website Applications
  await db.collection(MONGO_COLLECTIONS.WEBSITE_APPLICATIONS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'website_applications_id_unique' },
    {
      key: { workspaceId: 1, createdAt: -1 },
      name: 'website_applications_workspace_created_idx',
    },
    {
      key: { workspaceId: 1, inventoryState: 1, createdAt: -1 },
      name: 'website_applications_workspace_state_created_idx',
    },
  ]);

  // Inventory Nodes
  await db.collection(MONGO_COLLECTIONS.INVENTORY_NODES).createIndexes([
    { key: { id: 1 }, unique: true, name: 'inventory_nodes_id_unique' },
    {
      key: { workspaceId: 1, entityKind: 1, entityId: 1 },
      unique: true,
      name: 'inventory_nodes_workspace_kind_id_unique',
    },
  ]);

  // Inventory Relationships
  await db.collection(MONGO_COLLECTIONS.INVENTORY_RELATIONSHIPS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'inventory_relationships_id_unique' },
    {
      key: { workspaceId: 1, sourceNodeId: 1 },
      name: 'inventory_relationships_source_idx',
    },
    {
      key: { workspaceId: 1, targetNodeId: 1 },
      name: 'inventory_relationships_target_idx',
    },
  ]);

  // Metadata
  await db.collection(MONGO_COLLECTIONS.WHOIS_RECORDS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'whois_records_id_unique' },
    { key: { domain: 1 }, name: 'whois_records_domain_idx' },
  ]);

  await db.collection(MONGO_COLLECTIONS.DOMAIN_DNS_METADATA).createIndexes([
    { key: { id: 1 }, unique: true, name: 'domain_dns_metadata_id_unique' },
    { key: { domainId: 1 }, unique: true, name: 'domain_dns_metadata_domain_unique' },
  ]);

  await db.collection(MONGO_COLLECTIONS.DOMAIN_RDAP_METADATA).createIndexes([
    { key: { id: 1 }, unique: true, name: 'domain_rdap_metadata_id_unique' },
    { key: { domainId: 1 }, unique: true, name: 'domain_rdap_metadata_domain_unique' },
  ]);

  await db.collection(MONGO_COLLECTIONS.DOMAIN_TLS_METADATA).createIndexes([
    { key: { id: 1 }, unique: true, name: 'domain_tls_metadata_id_unique' },
    { key: { domainId: 1 }, unique: true, name: 'domain_tls_metadata_domain_unique' },
  ]);

  // Provider Connections
  await db.collection(MONGO_COLLECTIONS.PROVIDER_CONNECTIONS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'provider_connections_id_unique' },
    { key: { workspaceId: 1 }, name: 'provider_connections_workspace_idx' },
  ]);

  await db.collection(MONGO_COLLECTIONS.PROVIDER_SYNC_RUNS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'provider_sync_runs_id_unique' },
    {
      key: { providerConnectionId: 1 },
      name: 'provider_sync_runs_connection_idx',
    },
  ]);

  await db.collection(MONGO_COLLECTIONS.PROVIDER_RESOURCE_LINKS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'provider_resource_links_id_unique' },
    {
      key: { providerConnectionId: 1, resourceType: 1, externalId: 1 },
      unique: true,
      name: 'provider_resource_links_unique_external',
    },
  ]);

  // Monitoring
  await db.collection(MONGO_COLLECTIONS.MONITORING_TARGETS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'monitoring_targets_id_unique' },
    { key: { workspaceId: 1 }, name: 'monitoring_targets_workspace_idx' },
  ]);

  await db.collection(MONGO_COLLECTIONS.ALERT_RULES).createIndexes([
    { key: { id: 1 }, unique: true, name: 'alert_rules_id_unique' },
    { key: { workspaceId: 1 }, name: 'alert_rules_workspace_idx' },
  ]);

  await db.collection(MONGO_COLLECTIONS.ALERT_EVENTS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'alert_events_id_unique' },
    { key: { workspaceId: 1 }, name: 'alert_events_workspace_idx' },
    { key: { workspaceId: 1, status: 1, createdAt: -1 }, name: 'alert_events_workspace_status_created_idx' },
  ]);

  // Google Play
  await db.collection(MONGO_COLLECTIONS.GOOGLE_PLAY_CONNECTIONS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'google_play_connections_id_unique' },
    { key: { userId: 1 }, unique: true, name: 'google_play_connections_user_unique' },
  ]);

  await db.collection(MONGO_COLLECTIONS.GOOGLE_PLAY_OAUTH_STATES).createIndexes([
    { key: { id: 1 }, unique: true, name: 'google_play_oauth_states_id_unique' },
    { key: { state: 1 }, unique: true, name: 'google_play_oauth_states_state_unique' },
  ]);

  // Push Notifications & Expiry Monitoring
  await db.collection(MONGO_COLLECTIONS.NOTIFICATION_DEVICE_TOKENS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'notification_device_tokens_id_unique' },
    { key: { token: 1 }, unique: true, name: 'notification_device_tokens_token_unique' },
    { key: { userId: 1, isActive: 1 }, name: 'notification_device_tokens_user_active_idx' },
  ]);

  await db.collection(MONGO_COLLECTIONS.NOTIFICATION_PREFERENCES).createIndexes([
    { key: { id: 1 }, unique: true, name: 'notification_preferences_id_unique' },
    { key: { userId: 1 }, unique: true, name: 'notification_preferences_user_unique' },
  ]);

  await db.collection(MONGO_COLLECTIONS.NOTIFICATION_HISTORY).createIndexes([
    { key: { id: 1 }, unique: true, name: 'notification_history_id_unique' },
    {
      key: { assetId: 1, expiryDate: 1, reminderThreshold: 1, userId: 1 },
      unique: true,
      name: 'notification_history_asset_cycle_unique',
    },
    { key: { userId: 1, createdAt: -1 }, name: 'notification_history_user_created_idx' },
    { key: { status: 1 }, name: 'notification_history_status_idx' },
  ]);

  await db.collection(MONGO_COLLECTIONS.ASSET_EXPIRIES).createIndexes([
    { key: { id: 1 }, unique: true, name: 'asset_expiries_id_unique' },
    { key: { workspaceId: 1, assetType: 1 }, name: 'asset_expiries_workspace_type_idx' },
    {
      key: { ownerUserId: 1, status: 1, expiresAt: 1 },
      name: 'asset_expiries_owner_status_expires_idx',
    },
  ]);

  await db.collection(MONGO_COLLECTIONS.SCHEDULER_LOCKS).createIndexes([
    { key: { id: 1 }, unique: true, name: 'scheduler_locks_id_unique' },
  ]);
}
