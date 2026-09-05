export type EnvironmentType = 'Production' | 'Staging' | 'Development';
export type SslStatusType = 'healthy' | 'expiring' | 'warning';

export interface WebsiteRelationshipNode {
  type: 'account' | 'registrar' | 'domain' | 'app' | 'server';
  title: string;
  value: string;
  badge: string;
  icon: string;
  link?: string;
  isActive?: boolean;
}

export interface WebsiteDnsRecord {
  type: 'A' | 'CNAME' | 'AAAA' | 'TXT';
  name: string;
  target: string;
  badge: string;
  badgeType: 'proxied' | 'ttl' | 'default';
}

export interface WebsiteDnsData {
  provider: string;
  status: string;
  registrar: string;
  registrationEmail: string;
  nameservers: string[];
  records: WebsiteDnsRecord[];
  provenance: string;
}

export interface WebsiteHostingData {
  serverName: string;
  serverId: string;
  provider: string;
  providerAccount: string;
  accountEmail: string;
  os: string;
  datacenter: string;
  locationTag: string;
  ipAddress: string;
  costAllocation: {
    amountMonthly: number;
    currency: string;
    percentage: number;
    totalServerCost: number;
  };
  nextRenewalDate: string;
  monitoringStatus: string;
}

export interface WebsiteSslData {
  status: SslStatusType;
  statusLabel: string;
  daysRemaining: number;
  issuer: string;
  commonName: string;
  expirationDate: string;
  san: string[];
  provenance: string;
  signatureAlgorithm?: string;
  keySize?: string;
}

export interface WebsiteDeploymentData {
  method: string;
  methodProvenance: string;
  notes: string;
  internalTarget: string;
  reverseProxyConfigPath: string;
  processRunner: string;
  lastUpdated: string;
}

export interface WebsiteEnvironmentConfigData {
  variableCount: number;
  variableCountLabel: string;
  secretStorage: string;
  configFilePath: string;
  disclosureNote: string;
}

export interface WebsiteDetailData {
  id: string;
  internalRecordId: string;
  name: string;
  environment: EnvironmentType;
  project: string;
  primaryDomain: string;
  primaryUrl: string;
  domainRole: string;
  altHostnames: string[];
  altHostnamesRole: string;
  techStack: string;
  techStackSummary: string;
  port: number;
  reverseProxy: string;
  sourceRepoUrl: string;
  sourceRepoName: string;
  relationshipNodes: WebsiteRelationshipNode[];
  dns: WebsiteDnsData;
  hosting: WebsiteHostingData;
  ssl: WebsiteSslData;
  deployment: WebsiteDeploymentData;
  environmentConfig: WebsiteEnvironmentConfigData;
}
