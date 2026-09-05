export type ServerStatus = 'active' | 'attention' | 'inactive';

export interface HardwareSpecTile {
  label: string;
  value: string;
  badge: 'User Added' | 'Stored Provider Data' | 'Reference Data' | 'Stored Record';
  isMono?: boolean;
}

export interface HostedAppRecord {
  id: string;
  name: string;
  domain: string;
  runtime: string;
  port: number;
  reverseProxy: string;
  sslStatusText: string;
  sslRecorded: boolean;
  status: 'Mapped' | 'Tracked' | 'Inactive';
}

export interface DnsMappingRecord {
  id: string;
  hostname: string;
  recordType: 'A Record' | 'CNAME' | 'AAAA' | 'TXT';
  provenance: 'DNS Retrieved' | 'User Mapped';
  target: string;
  dnsProvider: string;
}

export interface RelationshipNode {
  id: string;
  label: string;
  icon: string;
  type: 'account' | 'provider' | 'server' | 'services' | 'domains';
  isCurrent?: boolean;
}

export interface BillingRenewalData {
  accountName: string;
  accountEmail: string;
  monthlyCostFormatted: string;
  annualizedCostFormatted: string;
  renewalDateFormatted: string;
  billingFrequency: string;
  autoRenew: boolean;
  notificationEmail: string;
  notificationLeadDays: number;
}

export interface ServerDetailData {
  id: string;
  name: string;
  hostname: string;
  status: ServerStatus;
  statusLabel: string;
  provider: string;
  providerAccountName: string;
  accountEmail: string;
  ipAddress: string;
  region: string;
  regionCode: string;
  osPlatform: string;
  computeSpecs: string;
  vcpuCount: number;
  ramGb: number;
  storageGb: number;
  project: string;
  tags: string[];
  specs: HardwareSpecTile[];
  relationshipNodes: RelationshipNode[];
  hostedApps: HostedAppRecord[];
  dnsMappings: DnsMappingRecord[];
  billing: BillingRenewalData;
  notes?: string;
}
