export interface User {
  id: string;
  email: string;
  displayName: string | null;
  organization?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface LoginResult {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  session: AuthSession;
  user: User;
}

export interface DomainItem {
  id: string;
  name: string;
  tld: string;
  registrar: string;
  autoRenew: boolean;
  registrationDate?: string;
  expiresAt: string;
  daysRemaining: number;
  renewalPrice: number;
  currency: string;
  status: 'safe' | 'warning' | 'critical';
  dnsProvider?: string;
  sslStatus?: 'active' | 'expiring' | 'expired' | 'none';
  httpStatus?: string;
  rdapStatus?: string;
  nameservers?: string[];
  tags?: string[];
  notes?: string;
  logoUrl?: string;
}

export interface ServerItem {
  id: string;
  name: string;
  provider: string;
  region?: string;
  ipAddress?: string;
  cpu?: string;
  memory?: string;
  os?: string;
  status: 'healthy' | 'warning' | 'offline';
  uptime?: string;
  cpuUsagePercent?: number;
  memoryUsagePercent?: number;
  diskUsagePercent?: number;
  connectedDomains?: string[];
}

export interface ApplicationItem {
  id: string;
  name: string;
  environment: 'Production' | 'Staging' | 'Development';
  status: 'healthy' | 'warning' | 'error';
  url?: string;
  serverName?: string;
  updatedAt?: string;
  packageId?: string;
  version?: string;
  developerName?: string;
  playStoreUrl?: string;
  iconUrl?: string;
  installs?: string;
  rating?: number;
  releaseTrack?: string;
}

export interface WebsiteItem {
  id: string;
  name: string;
  url: string;
  category?: 'Production' | 'Staging' | 'Personal' | 'Client' | 'Tools';
  status?: 'healthy' | 'warning' | 'error';
  sslStatus?: 'active' | 'expiring' | 'none';
  httpStatus?: string;
  responseTimeMs?: number;
  logoUrl?: string;
  tags?: string[];
  notes?: string;
  createdAt?: string;
  lastCheckedAt?: string;
}

export interface InventorySummary {
  domains: number;
  servers: number;
  cloudResources?: number;
  applications: number;
  alerts: number;
  criticalExpirations: number;
  warningExpirations: number;
  safeDomains: number;
  upcomingRenewals: number;
  estimatedRenewalCost: number;
  currency: string;
}

export interface DomainSearchResult {
  domain: string;
  tld: string;
  available: boolean;
  price?: number;
  currency?: string;
  premium?: boolean;
  whoisSummary?: {
    registrar?: string;
    creationDate?: string;
    expirationDate?: string;
  };
}

export interface RegistrarPricing {
  registrarId: string;
  registrarName: string;
  tld: string;
  registrationPrice: number;
  renewalPrice: number;
  transferPrice: number;
  currency: string;
  freePrivacy: boolean;
  freeDns: boolean;
  recommended?: boolean;
}

export interface AlertItem {
  id: string;
  domainId?: string;
  domainName: string;
  title: string;
  detail: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: string;
  timeAgo?: string;
  timeframeBadge?: string;
}

// Backend inventory models (mirroring apps/web/src/api/types.ts)
export interface InventoryMetadata {
  createdAt: string;
  id: string;
  inventoryState: 'TRACKED' | 'ARCHIVED';
  provenance:
    | 'USER_ADDED'
    | 'USER_MAPPED'
    | 'IMPORTED'
    | 'PROVIDER_API'
    | 'RDAP_RETRIEVED'
    | 'DNS_RETRIEVED'
    | 'SSL_RETRIEVED'
    | 'CALCULATED';
  updatedAt: string;
}

export interface BackendDomain extends InventoryMetadata {
  autoRenew: boolean | null;
  dnsProviderAccountId: string | null;
  domainName: string;
  expiresAt: string | null;
  notes: string | null;
  registeredAt: string | null;
  registrarProviderAccountId: string | null;
}

export interface BackendServer extends InventoryMetadata {
  expiresAt: string | null;
  hostname: string | null;
  name: string;
  notes: string | null;
  operatingSystem: string | null;
  primaryIp: string | null;
  providerAccountId: string | null;
  region: string | null;
  serverKind: string | null;
}

export type ApplicationKind =
  | 'WEBSITE'
  | 'WEB_APPLICATION'
  | 'API'
  | 'BACKEND_SERVICE'
  | 'MOBILE_APPLICATION'
  | 'OTHER';

export interface BackendApplication extends InventoryMetadata {
  kind: ApplicationKind;
  name: string;
  notes: string | null;
  primaryDomainId: string | null;
  primaryUrl: string | null;
  projectId: string | null;
}

export interface ProviderAccount extends InventoryMetadata {
  externalAccountId: string | null;
  label: string;
  loginEmailAccountId: string | null;
  notes: string | null;
  providerKey: string;
}

export interface EmailAccount extends InventoryMetadata {
  email: string;
  label: string | null;
  notes: string | null;
}

export interface CloudResource extends InventoryMetadata {
  externalResourceId: string | null;
  name: string;
  notes: string | null;
  providerAccountId: string;
  region: string | null;
  resourceType: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApplicationProbeResult {
  online: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  title: string | null;
  ssl: boolean;
  error: string | null;
}

export interface DomainMetadataResponse {
  canRefresh: boolean;
  domainId: string;
  rdap: {
    changedAt: string | null;
    expiresAt: string | null;
    nameservers: string[];
    registeredAt: string | null;
    registrarIanaId: string | null;
    registrarName: string | null;
    secureDnsDelegationSigned: boolean | null;
    sourceUrl: string | null;
    statuses: string[];
    lastAttemptStatus: string;
  } | null;
  dns: {
    aRecords: string[];
    aaaaRecords: string[];
    cnameRecords: string[];
    mxRecords: Array<{ exchange: string; priority: number }>;
    nsRecords: string[];
    recordErrors: Record<string, string>;
    txtRecordCount: number;
    lastAttemptStatus: string;
  } | null;
  tls: {
    fingerprint256: string | null;
    issuerCommonName: string | null;
    issuerOrganization: string | null;
    serialNumber: string | null;
    subjectAltNames: string[];
    subjectCommonName: string | null;
    validFrom: string | null;
    validTo: string | null;
    lastAttemptStatus: string;
  } | null;
}
