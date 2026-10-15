import mongoose, { Schema, type Model } from 'mongoose';

import type * as schema from '../schema';
import { MONGO_COLLECTIONS } from './mongo-indexes';

// Base schema options: don't auto-generate __v, preserve custom 'id' field, flexible for extensions
const schemaOptions = {
  timestamps: false,
  versionKey: false as const,
  strict: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
};

function getOrCreateModel<T>(name: string, schemaObj: any, collectionName: string): Model<T> {
  if (mongoose.models[name]) {
    return mongoose.models[name] as unknown as Model<T>;
  }
  return mongoose.model<T>(name, schemaObj, collectionName);
}

// User Schema
export const UserSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    normalizedEmail: { type: String, required: true, unique: true },
    displayName: { type: String, default: null },
    platformRole: { type: String, default: 'USER' },
    personalWorkspaceId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Workspace Schema
export const WorkspaceSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Workspace Member Schema
export const WorkspaceMemberSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, required: true },
    userId: { type: String, required: true },
    role: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Password Credential Schema
export const PasswordCredentialSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Session Schema
export const SessionSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    refreshTokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// OAuth Identity Schema
export const OAuthIdentitySchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    provider: { type: String, required: true },
    providerSubject: { type: String, required: true },
    email: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// OAuth Transaction Schema
export const OAuthTransactionSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    state: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    flow: { type: String, required: true },
    codeVerifier: { type: String, default: null },
    redirectUri: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Domain Schema
export const DomainSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, required: true },
    domainName: { type: String, required: true },
    unicodeDomainName: { type: String, default: null },
    recordState: { type: String, default: 'active' },
    provenance: { type: String, default: 'manual' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Server Schema
export const ServerSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, required: true },
    hostname: { type: String, required: true },
    ipv4Address: { type: String, default: null },
    ipv6Address: { type: String, default: null },
    recordState: { type: String, default: 'active' },
    provenance: { type: String, default: 'manual' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Provider Account Schema
export const ProviderAccountSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, required: true },
    providerName: { type: String, required: true },
    accountIdentifier: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Email Account Schema
export const EmailAccountSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, required: true },
    emailAddress: { type: String, required: true },
    providerAccountId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Cloud Resource Schema
export const CloudResourceSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceName: { type: String, required: true },
    providerAccountId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Project Schema
export const ProjectSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Website Application Schema
export const WebsiteApplicationSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, required: true },
    name: { type: String, required: true },
    applicationKind: { type: String, required: true },
    primaryDomainId: { type: String, default: null },
    projectId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Inventory Node Schema
export const InventoryNodeSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, required: true },
    entityKind: { type: String, required: true },
    entityId: { type: String, required: true },
    displayName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Inventory Relationship Schema
export const InventoryRelationshipSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, required: true },
    relationshipType: { type: String, required: true },
    sourceKind: { type: String, required: true },
    sourceId: { type: String, required: true },
    targetKind: { type: String, required: true },
    targetId: { type: String, required: true },
    provenance: { type: String, default: 'manual' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Whois Record Schema
export const WhoisRecordSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, default: null },
    domainId: { type: String, default: null },
    domainName: { type: String, required: true },
    normalizedDomainName: { type: String, required: true },
    isRegistered: { type: Boolean, required: true },
    registrarName: { type: String, default: null },
    registrarIanaId: { type: String, default: null },
    registrarWebsite: { type: String, default: null },
    registrarEmail: { type: String, default: null },
    registrarPhone: { type: String, default: null },
    registeredAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    updatedDate: { type: Date, default: null },
    nameservers: { type: [String], default: [] },
    statuses: { type: [String], default: [] },
    registrantContact: { type: Schema.Types.Mixed, default: null },
    administrativeContact: { type: Schema.Types.Mixed, default: null },
    technicalContact: { type: Schema.Types.Mixed, default: null },
    rawWhois: { type: String, default: null },
    rawResponse: { type: Schema.Types.Mixed, default: null },
    retrievedAt: { type: Date, default: Date.now },
    queryTime: { type: Number, default: 0 },
  },
  schemaOptions,
);

// Provider Connection Schema
export const ProviderConnectionSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, required: true },
    providerType: { type: String, required: true },
    authType: { type: String, required: true },
    connectionStatus: { type: String, default: 'active' },
    syncStatus: { type: String, default: 'idle' },
    validationStatus: { type: String, default: 'pending' },
    encryptedCredential: { type: String, required: true },
    credentialAad: { type: String, default: null },
    keyVersion: { type: Number, default: 1 },
    accountIdentifier: { type: String, default: null },
    errorMessage: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Monitoring Target Schema
export const MonitoringTargetSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, required: true },
    targetType: { type: String, required: true },
    targetReference: { type: String, required: true },
    checkFrequencySeconds: { type: Number, default: 300 },
    isEnabled: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Monitoring Run Schema
export const MonitoringRunSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, required: true },
    targetId: { type: String, required: true },
    status: { type: String, required: true },
    resultStatus: { type: String, default: null },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
  },
  schemaOptions,
);

// Alert Rule Schema
export const AlertRuleSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, required: true },
    ruleKey: { type: String, required: true },
    severity: { type: String, default: 'medium' },
    isEnabled: { type: Boolean, default: true },
    config: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Alert Event Schema
export const AlertEventSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    workspaceId: { type: String, required: true },
    ruleId: { type: String, required: true },
    status: { type: String, default: 'open' },
    summary: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
  },
  schemaOptions,
);

// Mobile App Config Schema
export const MobileAppConfigSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    appName: { type: String, default: 'DomainPulse' },
    logoUrl: { type: String, default: null },
    primaryColor: { type: String, default: '#2563EB' },
    secondaryColor: { type: String, default: '#1E293B' },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Mobile Feature Flag Schema
export const MobileFeatureFlagSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    enabled: { type: Boolean, default: true },
    minAppVersion: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Mobile Navigation Config Schema
export const MobileNavigationConfigSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    icon: { type: String, required: true },
    route: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
    badge: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Mobile Home Config Schema
export const MobileHomeConfigSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    sectionKey: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
    configJson: { type: Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Mobile App Version Schema
export const MobileAppVersionSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    platform: { type: String, required: true, unique: true },
    minimumVersion: { type: String, required: true },
    latestVersion: { type: String, required: true },
    forceUpdate: { type: Boolean, default: false },
    updateUrl: { type: String, default: null },
    releaseNotes: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Mobile Announcement Schema
export const MobileAnnouncementSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'info' },
    actionUrl: { type: String, default: null },
    actionLabel: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Mobile Audit Log Schema
export const MobileAuditLogSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    action: { type: String, required: true },
    target: { type: String, required: true },
    details: { type: String, default: null },
    userId: { type: String, default: null },
    ipAddress: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Google Play Connection Schema
export const GooglePlayConnectionSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, unique: true },
    googleAccountId: { type: String, required: true },
    googleAccountEmail: { type: String, required: true },
    developerAccountId: { type: String, default: null },
    encryptedAccessToken: { type: String, required: true },
    encryptedRefreshToken: { type: String, default: null },
    tokenExpiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Google Play OAuth State Schema
export const GooglePlayOAuthStateSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    state: { type: String, required: true, unique: true },
    codeVerifier: { type: String, required: true },
    developerAccountId: { type: String, default: null },
    redirectUri: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

// Export Mongoose Models bound to the exact MongoDB collection names
export const UserModel = getOrCreateModel<schema.User>('User', UserSchema, MONGO_COLLECTIONS.USERS);
export const WorkspaceModel = getOrCreateModel<schema.Workspace>('Workspace', WorkspaceSchema, MONGO_COLLECTIONS.WORKSPACES);
export const WorkspaceMemberModel = getOrCreateModel<schema.WorkspaceMember>('WorkspaceMember', WorkspaceMemberSchema, MONGO_COLLECTIONS.WORKSPACE_MEMBERS);
export const PasswordCredentialModel = getOrCreateModel<schema.PasswordCredential>('PasswordCredential', PasswordCredentialSchema, MONGO_COLLECTIONS.PASSWORD_CREDENTIALS);
export const SessionModel = getOrCreateModel<schema.Session>('Session', SessionSchema, MONGO_COLLECTIONS.SESSIONS);
export const OAuthIdentityModel = getOrCreateModel<schema.OAuthIdentity>('OAuthIdentity', OAuthIdentitySchema, MONGO_COLLECTIONS.OAUTH_IDENTITIES);
export const OAuthTransactionModel = getOrCreateModel<schema.OAuthTransaction>('OAuthTransaction', OAuthTransactionSchema, MONGO_COLLECTIONS.OAUTH_TRANSACTIONS);
export const DomainModel = getOrCreateModel<schema.Domain>('Domain', DomainSchema, MONGO_COLLECTIONS.DOMAINS);
export const ServerModel = getOrCreateModel<schema.Server>('Server', ServerSchema, MONGO_COLLECTIONS.SERVERS);
export const ProviderAccountModel = getOrCreateModel<schema.ProviderAccount>('ProviderAccount', ProviderAccountSchema, MONGO_COLLECTIONS.PROVIDER_ACCOUNTS);
export const EmailAccountModel = getOrCreateModel<schema.EmailAccount>('EmailAccount', EmailAccountSchema, MONGO_COLLECTIONS.EMAIL_ACCOUNTS);
export const CloudResourceModel = getOrCreateModel<schema.CloudResource>('CloudResource', CloudResourceSchema, MONGO_COLLECTIONS.CLOUD_RESOURCES);
export const ProjectModel = getOrCreateModel<schema.Project>('Project', ProjectSchema, MONGO_COLLECTIONS.PROJECTS);
export const WebsiteApplicationModel = getOrCreateModel<schema.WebsiteApplication>('WebsiteApplication', WebsiteApplicationSchema, MONGO_COLLECTIONS.WEBSITE_APPLICATIONS);
export const InventoryNodeModel = getOrCreateModel<schema.InventoryNode>('InventoryNode', InventoryNodeSchema, MONGO_COLLECTIONS.INVENTORY_NODES);
export const InventoryRelationshipModel = getOrCreateModel<schema.InventoryRelationship>('InventoryRelationship', InventoryRelationshipSchema, MONGO_COLLECTIONS.INVENTORY_RELATIONSHIPS);
export const WhoisRecordModel = getOrCreateModel<schema.WhoisRecord>('WhoisRecord', WhoisRecordSchema, MONGO_COLLECTIONS.WHOIS_RECORDS);
export const ProviderConnectionModel = getOrCreateModel<schema.ProviderConnection>('ProviderConnection', ProviderConnectionSchema, MONGO_COLLECTIONS.PROVIDER_CONNECTIONS);
export const MonitoringTargetModel = getOrCreateModel<schema.MonitoringTarget>('MonitoringTarget', MonitoringTargetSchema, MONGO_COLLECTIONS.MONITORING_TARGETS);
export const MonitoringRunModel = getOrCreateModel<schema.MonitoringRun>('MonitoringRun', MonitoringRunSchema, MONGO_COLLECTIONS.MONITORING_RUNS);
export const AlertRuleModel = getOrCreateModel<schema.AlertRule>('AlertRule', AlertRuleSchema, MONGO_COLLECTIONS.ALERT_RULES);
export const AlertEventModel = getOrCreateModel<schema.AlertEvent>('AlertEvent', AlertEventSchema, MONGO_COLLECTIONS.ALERT_EVENTS);
export const MobileAppConfigModel = getOrCreateModel<schema.MobileAppConfigTable>('MobileAppConfig', MobileAppConfigSchema, MONGO_COLLECTIONS.MOBILE_APP_CONFIG);
export const MobileFeatureFlagModel = getOrCreateModel<schema.MobileFeatureFlagTable>('MobileFeatureFlag', MobileFeatureFlagSchema, MONGO_COLLECTIONS.MOBILE_FEATURE_FLAGS);
export const MobileNavigationConfigModel = getOrCreateModel<schema.MobileNavigationConfigTable>('MobileNavigationConfig', MobileNavigationConfigSchema, MONGO_COLLECTIONS.MOBILE_NAVIGATION_CONFIG);
export const MobileHomeConfigModel = getOrCreateModel<schema.MobileHomeConfigTable>('MobileHomeConfig', MobileHomeConfigSchema, MONGO_COLLECTIONS.MOBILE_HOME_CONFIG);
export const MobileAppVersionModel = getOrCreateModel<schema.MobileAppVersionTable>('MobileAppVersion', MobileAppVersionSchema, MONGO_COLLECTIONS.MOBILE_APP_VERSIONS);
export const MobileAnnouncementModel = getOrCreateModel<schema.MobileAnnouncementTable>('MobileAnnouncement', MobileAnnouncementSchema, MONGO_COLLECTIONS.MOBILE_ANNOUNCEMENTS);
export const MobileAuditLogModel = getOrCreateModel<schema.MobileAuditLogTable>('MobileAuditLog', MobileAuditLogSchema, MONGO_COLLECTIONS.MOBILE_AUDIT_LOGS);
export const GooglePlayConnectionModel = getOrCreateModel<schema.GooglePlayConnection>('GooglePlayConnection', GooglePlayConnectionSchema, MONGO_COLLECTIONS.GOOGLE_PLAY_CONNECTIONS);
export const GooglePlayOAuthStateModel = getOrCreateModel<schema.GooglePlayOAuthState>('GooglePlayOAuthState', GooglePlayOAuthStateSchema, MONGO_COLLECTIONS.GOOGLE_PLAY_OAUTH_STATES);

export { mongoose };
