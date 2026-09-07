export type SettingsCategory =
  | 'general'
  | 'portfolio'
  | 'domain-discovery'
  | 'alerts'
  | 'pricing'
  | 'appearance'
  | 'data-management';

export type SaveState = 'saved' | 'unsaved' | 'saving' | 'error';

export interface GeneralSettings {
  workspaceDisplayName: string;
  workspaceName: string;
  defaultLandingPage: string;
  timezone: string;
  dateFormat: string;
  defaultCurrency: string;
  rowsPerPage: number;
}

export interface PortfolioSettings {
  automaticMetadataRefresh: 'on-start' | 'manual';
  domainMetadataSources: {
    rdap: boolean;
    dns: boolean;
    ssl: boolean;
  };
  relationshipDisplayMode: 'mapped' | 'all';
  defaultInfrastructureView: 'inventory' | 'compact';
  defaultAutoRenewAssumption: 'on' | 'off' | 'unknown';
  criticalThresholdDays: number;
  warningThresholdDays: number;
  healthyThresholdDays: number;
  defaultCategoryTag: string;
  autoFetchMetadataOnCreation: boolean;
}

export interface DomainDiscoverySettings {
  defaultCheckedTlds: string[];
  defaultDiscoveryMode: 'reference-preview' | 'compact';
  savedSearchHistory: boolean;
  defaultRegistrarComparison: 'best-value' | 'renewal-first' | 'lowest-initial';
  domainAvailabilitySource: 'reference-dataset';
  preferredSuggestionStyle: 'brandable' | 'short' | 'modern' | 'tech';
  smartNameVariations: boolean;
  availabilityCheckMode: 'selected' | 'all';
  defaultSearchSort: 'availability' | 'price' | 'tld' | 'match';
}

export interface AlertsNotificationSettings {
  criticalThreshold: string;
  warningThreshold: string;
  healthyThreshold: string;
  reminderIntervals: {
    thirtyDays: boolean;
    fifteenDays: boolean;
    sevenDays: boolean;
    threeDays: boolean;
    oneDay: boolean;
  };
  sslReminderIntervals: {
    thirtyDays: boolean;
    fourteenDays: boolean;
    sevenDays: boolean;
  };
  autoRenewDiscrepancyAlert: boolean;
  dnsResolutionCheck: boolean;
  channels: {
    inAppDashboard: boolean;
    browserPush: boolean;
    email: boolean;
    whatsapp: boolean;
  };
}

export interface PricingCurrencySettings {
  defaultCurrency: string;
  pricingMode: 'reference-dataset';
  defaultPricingHorizon: '1-year' | '3-years' | '5-years';
  defaultComparisonSort: 'best-value' | 'lowest-renewal' | 'lowest-first-year';
  includeWhoisPrivacy: boolean;
  includeDnssec: boolean;
  renewalMarkupThreshold: number;
  showRegistrationPriceColumn: boolean;
  showRenewalPriceColumn: boolean;
  showTransferPriceColumn: boolean;
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  density: 'compact' | 'comfortable';
  sidebar: 'expanded' | 'collapsed' | 'remember';
  tableRowDensity: 'compact' | 'standard';
  monoDataFont: 'JetBrains Mono';
  interfaceFont: 'Inter';
  microInteractions: boolean;
  respectReducedMotion: boolean;
}

export interface WorkspaceDataSummary {
  storage: string;
  domainDataSources: string;
  pricingMode: string;
  monitoringState: string;
  totalDomainsCount: number;
  totalServersCount: number;
  totalWebsitesCount: number;
  totalAccountsCount: number;
}

export interface DomainPulseSettings {
  general: GeneralSettings;
  portfolio: PortfolioSettings;
  domainDiscovery: DomainDiscoverySettings;
  alerts: AlertsNotificationSettings;
  pricing: PricingCurrencySettings;
  appearance: AppearanceSettings;
}
