export type WebsiteEnvironment = 'Production' | 'Staging' | 'Development';
export type WebsiteSslStatus = 'healthy' | 'expiring' | 'warning';

export interface WebsiteRecord {
  id: string;
  name: string;
  avatarLetter: string;
  avatarBgColor: string;
  avatarTextColor: string;
  domain: string;
  routeNote: string;
  environment: WebsiteEnvironment;
  serverName: string;
  serverProvider: string;
  serverAccountEmail: string;
  serverId: string;
  project: string;
  techStack: string;
  port: number;
  reverseProxy: string;
  sslStatus: WebsiteSslStatus;
  sslLabel: string;
  sslDetails: string;
  connectedDomainsCount: number;
  ipAddress: string;
  notes?: string;
  repoUrl?: string;
}

export interface WebsiteSummaryMetrics {
  totalAssets: number;
  productionCount: number;
  stagingDevCount: number;
  attentionCount: number;
  serversUsedCount: number;
  connectedDomainsCount: number;
}

export interface WebsiteFilterState {
  searchQuery: string;
  environment: 'all' | 'production' | 'staging' | 'development';
  server: string;
  techStack: string;
  sslStatus: 'all' | 'healthy' | 'expiring' | 'warning';
  project: string;
  activeChip?: 'prod' | 'attention' | 'nextjs' | null;
}

export interface WebsiteFilterOptions {
  environments: { label: string; value: string }[];
  servers: { label: string; value: string }[];
  techStacks: { label: string; value: string }[];
  sslStatuses: { label: string; value: string }[];
  projects: { label: string; value: string }[];
}

export interface WebsitesReferenceDataset {
  summary: WebsiteSummaryMetrics;
  websites: WebsiteRecord[];
  filterOptions: WebsiteFilterOptions;
}
