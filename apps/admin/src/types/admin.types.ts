export type PlatformRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'USER';
export type UserStatus = 'active' | 'suspended';
export type UserType = 'web' | 'mobile' | 'both';
export type UserPlan = 'Free' | 'Pro' | 'Enterprise';

export interface WebDomainItem {
  id: string;
  domainName: string;
  status: 'active' | 'expiring' | 'expired' | 'error';
  sslStatus: 'valid' | 'expiring' | 'expired' | 'missing';
  expiresAt: string | null;
  registrarName: string;
  createdAt: string;
  workspaceId?: string;
  ownerEmail?: string;
  ownerName?: string;
  ownerUserId?: string;
}

export interface WebServerItem {
  id: string;
  name: string;
  host: string;
  status: 'healthy' | 'degraded' | 'offline' | 'archived';
  uptimePercent: number;
  lastSeenAt?: string;
  createdAt?: string;
  workspaceId?: string;
  ownerEmail?: string;
  ownerName?: string;
  ownerUserId?: string;
  primaryIp?: string;
  hostname?: string;
  operatingSystem?: string;
  serverKind?: string;
  providerLabel?: string;
}

export interface WebApplicationItem {
  id: string;
  name: string;
  kind?: string;
  primaryUrl?: string | null;
  notes?: string | null;
  status?: string;
  state?: string;
  inventoryState?: string;
  workspaceId?: string;
  createdAt?: string;
}

export interface ProviderAccountItem {
  id: string;
  providerKey: string;
  label: string;
  notes?: string | null;
  externalAccountId?: string | null;
  workspaceId?: string;
  createdAt?: string;
}

export interface UserWorkspaceItem {
  id: string;
  name: string;
  slug?: string;
  role?: string;
  createdAt?: string;
}

export interface MobileDeviceItem {
  id: string;
  platform: 'ios' | 'android' | 'unknown';
  deviceName: string;
  appVersion: string;
  token?: string;
  isActive: boolean;
  lastSeenAt: string;
  createdAt?: string;
}

export interface UserSessionItem {
  id: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt?: string;
  ipAddress?: string;
  userAgent?: string;
  isRevoked: boolean;
}

export interface UserNotificationItem {
  id: string;
  title: string;
  message: string;
  status: 'delivered' | 'read' | 'pending' | 'failed';
  createdAt: string;
}

export interface UserAuditItem {
  id: string;
  action: string;
  target: string;
  details?: string | Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface PlatformUser {
  id: string;
  email: string;
  normalizedEmail: string;
  displayName: string;
  platformRole: PlatformRole;
  status: UserStatus;
  suspendReason?: string | null;
  personalWorkspaceId: string;
  type: UserType;
  plan: UserPlan;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  lastLoginIp?: string;
  webData: {
    domainsCount: number;
    serversCount: number;
    applicationsCount: number;
    providersCount: number;
    alertRulesCount: number;
    activeSessionsCount: number;
    topDomain?: string | null;
    domains?: WebDomainItem[];
    servers?: WebServerItem[];
    applications?: WebApplicationItem[];
    providerAccounts?: ProviderAccountItem[];
    workspaces?: UserWorkspaceItem[];
    activeSessions?: UserSessionItem[];
    alertRules?: Array<{ id: string; name: string; enabled: boolean; channel: string }>;
  };
  mobileData: {
    devicesCount: number;
    latestAppVersion: string;
    pushTokensCount: number;
    devices?: MobileDeviceItem[];
    notifications?: UserNotificationItem[];
  };
  auditLogs?: UserAuditItem[];
}

export interface PlatformStats {
  totalUsers: number;
  webUsersCount: number;
  mobileUsersCount: number;
  bothUsersCount: number;
  totalDomains: number;
  activeDomains: number;
  expiringSoonDomains: number;
  totalServers: number;
  healthyServers: number;
  totalApplications?: number;
  totalProviders?: number;
  mobileDevicesTotal: number;
  iosDevicesCount: number;
  androidDevicesCount: number;
  announcementsCount: number;
  systemHealth: {
    status: 'operational' | 'degraded' | 'maintenance';
    uptime: string;
    apiLatency: string;
    databaseStatus: string;
    workerStatus: string;
  };
  recentAuditLogs: Array<{
    id: string;
    action: string;
    target: string;
    details: string;
    ipAddress?: string;
    createdAt: string;
  }>;
}
