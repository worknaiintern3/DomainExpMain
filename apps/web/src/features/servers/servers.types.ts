export type ServerStatus = 'active' | 'attention' | 'inactive';

export interface ConnectedWebsite {
  id: string;
  domain: string;
  tag: string;
  sslAvailable: boolean; // Stored reference fixture flag (displayed truthfully as 'SSL: Recorded')
}

export interface ServerRecord {
  id: string;
  name: string;
  hostname: string;
  provider: string;
  providerColor: {
    bg: string;
    text: string;
    dot: string;
  };
  accountName: string;
  accountEmail: string;
  ipAddress: string;
  region: string;
  regionCode: string;
  osPlatform: string;
  computeSpecs: string;
  vcpuCount: number;
  ramGb: number;
  storageGb: number;
  storageType: string;
  storageProgressPercentage: number;
  hostedWebsitesCount: number;
  monthlyCost: number;
  monthlyCostFormatted: string;
  annualizedRunRateFormatted: string;
  renewalDateFormatted: string;
  renewalDaysRemaining?: number;
  autoRenew: boolean;
  status: ServerStatus;
  statusLabel: string;
  connectedWebsites: ConnectedWebsite[];
  notes?: string;
}

export interface ServerSummaryMetrics {
  totalServers: number;
  activeCount: number;
  attentionCount: number;
  hostedWebsitesCount: number;
  totalMonthlyCost: number;
  totalMonthlyCostFormatted: string;
  upcomingRenewalsCount: number;
  upcomingRenewalsSubtext: string;
}

export interface ServerFilterState {
  searchQuery: string;
  status: 'All' | 'Active' | 'Attention';
  provider: string;
  region: string;
  accountEmail: string;
  os: string;
  sortBy: 'Renewal Soonest' | 'Monthly Cost (High to Low)' | 'Server Name (A-Z)' | 'Websites Count';
}

export interface ServerFilterOptions {
  providers: string[];
  regions: string[];
  accountEmails: string[];
  osList: string[];
  sortOptions: string[];
}

export interface ServersReferenceDataset {
  summary: ServerSummaryMetrics;
  servers: ServerRecord[];
  filterOptions: ServerFilterOptions;
}
