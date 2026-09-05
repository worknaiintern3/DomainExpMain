export type DomainHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface DomainRecord {
  id: string;
  domain: string;
  tldBadge: string;
  sslStatusText: string;
  dnsProviderText: string;
  registrar: string;
  registrarDotColor: string;
  expiryDateFormatted: string;
  daysRemaining: number;
  renewalCost: number;
  renewalCostFormatted: string;
  autoRenew: boolean;
  status: DomainHealthStatus;
  projectTag: string;
  nameservers: string[];
  sslProvider: string;
  whoisPrivacy: boolean;
  notes?: string;
  isPrimary?: boolean;
}

export interface DomainSummaryMetrics {
  totalCount: number;
  healthyCount: number;
  healthyPercentage: number;
  warningCount: number;
  criticalCount: number;
  autoRenewCount: number;
  totalAnnualCostFormatted: string;
}

export interface DomainFilterState {
  searchQuery: string;
  status: string;
  registrar: string;
  tld: string;
  autoRenew: string;
  tag: string;
  sortBy: string;
}

export interface DomainsReferenceDataset {
  summary: DomainSummaryMetrics;
  domains: DomainRecord[];
  filterOptions: {
    statuses: string[];
    registrars: string[];
    tlds: string[];
    autoRenewOptions: string[];
    tags: string[];
    sortOptions: string[];
  };
}
