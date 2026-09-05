export type AccountMappingStatus = 'mapped' | 'stored' | 'expiring' | 'warning';

export interface ProviderAccount {
  id: string;
  providerCompany: string;
  accountName: string;
  accountId: string;
  accountEmail: string;
  logoLetter: string;
  logoBgColor: string;
  logoTextColor: string;
  mappingStatus: AccountMappingStatus;
  mappingStatusLabel: string;
  domainsCount: number;
  serversCount: number;
  websitesCount: number;
  workersCount?: number;
  sampleAssets: string[];
  moreAssetsCount?: number;
  autoRenewalText?: string;
  estimatedCostMonthly?: string;
  project?: string;
  notes?: string;
}

export interface EmailGroup {
  id: string;
  email: string;
  icon: string;
  iconIsMaterial?: boolean;
  iconBgColor: string;
  iconTextColor: string;
  subtitle: string;
  providerCount: number;
  linkedAssetsCount: number;
  estimatedCostMonthly?: string;
  badgeText: string;
  providerAccounts: ProviderAccount[];
}

export interface UnmappedAsset {
  id: string;
  name: string;
  subtext?: string;
  assetType: 'Domain' | 'Server' | 'Website / Zone';
  currentProvider: string;
  missingRelationship: string;
  actionLabel: string;
}

export interface AccountsSummary {
  managedEmailsCount: number;
  managedEmailsSubtext: string;
  providerAccountsCount: number;
  providerAccountsSubtext: string;
  domainsLinkedCount: number;
  domainsLinkedSubtext: string;
  serversLinkedCount: number;
  serversLinkedSubtext: string;
  unmappedAssetsCount: number;
  unmappedAssetsSubtext: string;
}

export interface AccountsFilterState {
  searchQuery: string;
  provider: string;
  assetType: string;
  project: string;
  viewMode: 'grouped' | 'flat';
}
