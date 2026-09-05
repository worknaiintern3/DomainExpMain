export interface OwnedServerRecord {
  id: string;
  name: string;
  hostname: string;
  osPlatform: string;
  ipAddress: string;
  hardwareSizing: string;
  vcpuCount: number;
  ramGb: number;
  storageSpecs: string;
  websitesCount: number;
  monthlyCost: number;
  monthlyCostFormatted: string;
  renewalDate: string;
  statusLabel: string;
}

export interface LinkedDomainRecord {
  id: string;
  domain: string;
  domainType: 'Apex Root' | 'Sub-brand' | 'Zone';
  dnsRoutingTarget: string;
  targetIp: string;
  nameserver: string;
  nameserverBadge: string;
  sslProfile: string;
  sslBadge: string;
  projectName: string;
  projectId: string;
}

export interface AssociatedProjectRecord {
  id: string;
  name: string;
  linkedAssetsCount: number;
  description: string;
  mappedServers: string[];
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  amountFormatted: string;
  statusText: string;
  dateFormatted?: string;
}

export interface AccountBillingRecord {
  billingContact: string;
  billingContactBadge?: string;
  currency: string;
  autoRenewStatus: string;
  billingCycle: string;
  nextRenewalFormatted: string;
  taxEntityName: string;
  taxStatusBadge: string;
  gstinNumber: string;
  recentInvoices: InvoiceRecord[];
}

export interface AccountRelationshipNode {
  label: string;
  value: string;
  icon: string;
  iconColor?: string;
  isActive?: boolean;
}

export interface ProviderAccountKpis {
  ownedServersCount: number;
  ownedServersSubtext: string;
  hostedWebsitesCount: number;
  hostedWebsitesSubtext: string;
  linkedDomainsCount: number;
  linkedDomainsSubtext: string;
  estimatedMonthlyCostFormatted: string;
  estimatedMonthlyCostSubtext: string;
  estimatedAnnualCostFormatted: string;
  estimatedAnnualCostSubtext: string;
  nextRenewalFormatted: string;
  nextRenewalSubtext: string;
}

export interface ProviderAccountDetail {
  id: string;
  accountId: string; // Internal record id, e.g. HST-941029
  accountName: string; // e.g. WorknAi Hostinger Main
  providerCompany: string; // e.g. Hostinger
  providerBadgeText: string; // e.g. HOSTINGER CLOUD
  accountEmail: string; // e.g. infra@worknai.com
  accountType: string; // e.g. Hosting / VPS & Cloud Compute
  accountScope: string; // e.g. Infrastructure Portfolio
  mappingStatus: 'mapped' | 'stored' | 'attention';
  mappingStatusLabel: string; // e.g. Mapped • User Record
  
  relationshipNodes: AccountRelationshipNode[];
  kpis: ProviderAccountKpis;
  ownedServers: OwnedServerRecord[];
  linkedDomains: LinkedDomainRecord[];
  associatedProjects: AssociatedProjectRecord[];
  coverageText: string;
  
  billing: AccountBillingRecord;
  notes: string;
  lastRecordUpdateText: string;
  discoveredChangesText: string;
  mappingCoverageText: string;
}
