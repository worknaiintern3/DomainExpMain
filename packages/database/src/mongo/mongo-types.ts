import type { Collection, Db, WithId } from 'mongodb';

import type * as schema from '../schema';
import { MONGO_COLLECTIONS } from './mongo-indexes';

export type MongoDocument<T> = WithId<T>;

export interface MongoCollections {
  users: Collection<schema.User>;
  workspaces: Collection<schema.Workspace>;
  workspaceMembers: Collection<schema.WorkspaceMember>;
  passwordCredentials: Collection<schema.PasswordCredential>;
  sessions: Collection<schema.Session>;
  oauthIdentities: Collection<schema.OAuthIdentity>;
  oauthTransactions: Collection<schema.OAuthTransaction>;
  domains: Collection<schema.Domain>;
  servers: Collection<schema.Server>;
  providerAccounts: Collection<schema.ProviderAccount>;
  emailAccounts: Collection<schema.EmailAccount>;
  cloudResources: Collection<schema.CloudResource>;
  projects: Collection<schema.Project>;
  websiteApplications: Collection<schema.WebsiteApplication>;
  inventoryNodes: Collection<schema.InventoryNode>;
  inventoryRelationships: Collection<schema.InventoryRelationship>;
  whoisRecords: Collection<schema.WhoisRecord>;
  domainDnsMetadata: Collection<schema.DomainDnsMetadata>;
  domainRdapMetadata: Collection<schema.DomainRdapMetadata>;
  domainTlsMetadata: Collection<schema.DomainTlsMetadata>;
  providerConnections: Collection<schema.ProviderConnection>;
  providerSyncRuns: Collection<schema.ProviderSyncRun>;
  providerResourceLinks: Collection<schema.ProviderResourceLink>;
  monitoringTargets: Collection<schema.MonitoringTarget>;
  monitoringRuns: Collection<schema.MonitoringRun>;
  alertRules: Collection<schema.AlertRule>;
  alertEvents: Collection<schema.AlertEvent>;
  mobileAppConfig: Collection<schema.MobileAppConfigTable>;
  mobileAppVersions: Collection<schema.MobileAppVersionTable>;
  mobileHomeConfig: Collection<schema.MobileHomeConfigTable>;
  mobileNavigationConfig: Collection<schema.MobileNavigationConfigTable>;
  mobileFeatureFlags: Collection<schema.MobileFeatureFlagTable>;
  mobileAnnouncements: Collection<schema.MobileAnnouncementTable>;
  mobileAuditLogs: Collection<schema.MobileAuditLogTable>;
  googlePlayConnections: Collection<schema.GooglePlayConnection>;
  googlePlayOauthStates: Collection<schema.GooglePlayOAuthState>;
  notificationDeviceTokens: Collection<schema.NotificationDeviceToken>;
  notificationPreferences: Collection<schema.NotificationPreference>;
  notificationHistory: Collection<schema.NotificationHistoryItem>;
  assetExpiries: Collection<schema.AssetExpiry>;
  schedulerLocks: Collection<schema.SchedulerLock>;
}

export function getMongoCollections(db: Db): MongoCollections {
  return {
    users: db.collection<schema.User>(MONGO_COLLECTIONS.USERS),
    workspaces: db.collection<schema.Workspace>(MONGO_COLLECTIONS.WORKSPACES),
    workspaceMembers: db.collection<schema.WorkspaceMember>(
      MONGO_COLLECTIONS.WORKSPACE_MEMBERS,
    ),
    passwordCredentials: db.collection<schema.PasswordCredential>(
      MONGO_COLLECTIONS.PASSWORD_CREDENTIALS,
    ),
    sessions: db.collection<schema.Session>(MONGO_COLLECTIONS.SESSIONS),
    oauthIdentities: db.collection<schema.OAuthIdentity>(
      MONGO_COLLECTIONS.OAUTH_IDENTITIES,
    ),
    oauthTransactions: db.collection<schema.OAuthTransaction>(
      MONGO_COLLECTIONS.OAUTH_TRANSACTIONS,
    ),
    domains: db.collection<schema.Domain>(MONGO_COLLECTIONS.DOMAINS),
    servers: db.collection<schema.Server>(MONGO_COLLECTIONS.SERVERS),
    providerAccounts: db.collection<schema.ProviderAccount>(
      MONGO_COLLECTIONS.PROVIDER_ACCOUNTS,
    ),
    emailAccounts: db.collection<schema.EmailAccount>(
      MONGO_COLLECTIONS.EMAIL_ACCOUNTS,
    ),
    cloudResources: db.collection<schema.CloudResource>(
      MONGO_COLLECTIONS.CLOUD_RESOURCES,
    ),
    projects: db.collection<schema.Project>(MONGO_COLLECTIONS.PROJECTS),
    websiteApplications: db.collection<schema.WebsiteApplication>(
      MONGO_COLLECTIONS.WEBSITE_APPLICATIONS,
    ),
    inventoryNodes: db.collection<schema.InventoryNode>(
      MONGO_COLLECTIONS.INVENTORY_NODES,
    ),
    inventoryRelationships: db.collection<schema.InventoryRelationship>(
      MONGO_COLLECTIONS.INVENTORY_RELATIONSHIPS,
    ),
    whoisRecords: db.collection<schema.WhoisRecord>(MONGO_COLLECTIONS.WHOIS_RECORDS),
    domainDnsMetadata: db.collection<schema.DomainDnsMetadata>(
      MONGO_COLLECTIONS.DOMAIN_DNS_METADATA,
    ),
    domainRdapMetadata: db.collection<schema.DomainRdapMetadata>(
      MONGO_COLLECTIONS.DOMAIN_RDAP_METADATA,
    ),
    domainTlsMetadata: db.collection<schema.DomainTlsMetadata>(
      MONGO_COLLECTIONS.DOMAIN_TLS_METADATA,
    ),
    providerConnections: db.collection<schema.ProviderConnection>(
      MONGO_COLLECTIONS.PROVIDER_CONNECTIONS,
    ),
    providerSyncRuns: db.collection<schema.ProviderSyncRun>(
      MONGO_COLLECTIONS.PROVIDER_SYNC_RUNS,
    ),
    providerResourceLinks: db.collection<schema.ProviderResourceLink>(
      MONGO_COLLECTIONS.PROVIDER_RESOURCE_LINKS,
    ),
    monitoringTargets: db.collection<schema.MonitoringTarget>(
      MONGO_COLLECTIONS.MONITORING_TARGETS,
    ),
    monitoringRuns: db.collection<schema.MonitoringRun>(
      MONGO_COLLECTIONS.MONITORING_RUNS,
    ),
    alertRules: db.collection<schema.AlertRule>(MONGO_COLLECTIONS.ALERT_RULES),
    alertEvents: db.collection<schema.AlertEvent>(MONGO_COLLECTIONS.ALERT_EVENTS),
    mobileAppConfig: db.collection<schema.MobileAppConfigTable>(
      MONGO_COLLECTIONS.MOBILE_APP_CONFIG,
    ),
    mobileAppVersions: db.collection<schema.MobileAppVersionTable>(
      MONGO_COLLECTIONS.MOBILE_APP_VERSIONS,
    ),
    mobileHomeConfig: db.collection<schema.MobileHomeConfigTable>(
      MONGO_COLLECTIONS.MOBILE_HOME_CONFIG,
    ),
    mobileNavigationConfig: db.collection<schema.MobileNavigationConfigTable>(
      MONGO_COLLECTIONS.MOBILE_NAVIGATION_CONFIG,
    ),
    mobileFeatureFlags: db.collection<schema.MobileFeatureFlagTable>(
      MONGO_COLLECTIONS.MOBILE_FEATURE_FLAGS,
    ),
    mobileAnnouncements: db.collection<schema.MobileAnnouncementTable>(
      MONGO_COLLECTIONS.MOBILE_ANNOUNCEMENTS,
    ),
    mobileAuditLogs: db.collection<schema.MobileAuditLogTable>(
      MONGO_COLLECTIONS.MOBILE_AUDIT_LOGS,
    ),
    googlePlayConnections: db.collection<schema.GooglePlayConnection>(
      MONGO_COLLECTIONS.GOOGLE_PLAY_CONNECTIONS,
    ),
    googlePlayOauthStates: db.collection<schema.GooglePlayOAuthState>(
      MONGO_COLLECTIONS.GOOGLE_PLAY_OAUTH_STATES,
    ),
    notificationDeviceTokens: db.collection<schema.NotificationDeviceToken>(
      MONGO_COLLECTIONS.NOTIFICATION_DEVICE_TOKENS,
    ),
    notificationPreferences: db.collection<schema.NotificationPreference>(
      MONGO_COLLECTIONS.NOTIFICATION_PREFERENCES,
    ),
    notificationHistory: db.collection<schema.NotificationHistoryItem>(
      MONGO_COLLECTIONS.NOTIFICATION_HISTORY,
    ),
    assetExpiries: db.collection<schema.AssetExpiry>(
      MONGO_COLLECTIONS.ASSET_EXPIRIES,
    ),
    schedulerLocks: db.collection<schema.SchedulerLock>(
      MONGO_COLLECTIONS.SCHEDULER_LOCKS,
    ),
  };
}
