export interface GeneralSettingsPayload {
  dateFormat: string;
  defaultLandingPage: string;
  displayName: string | null;
  rowsPerPage: number;
  timezone: string;
  workspaceName: string;
}

export interface PortfolioSettingsPayload {
  autoFetchMetadataOnCreation: boolean;
  automaticMetadataRefresh: string;
  criticalThresholdDays: number;
  defaultAutoRenew: string;
  metadataSources: {
    dns: boolean;
    http: boolean;
    infra: boolean;
    rdap: boolean;
    tls: boolean;
  };
  warningThresholdDays: number;
}

export interface DiscoverySettingsPayload {
  availabilityCheckMode: 'selected' | 'all';
  defaultCheckedTlds: string[];
  defaultSearchSort: 'availability' | 'price' | 'tld' | 'match';
  savedSearchHistory: boolean;
}

export interface SettingsResponse {
  discovery: DiscoverySettingsPayload;
  general: GeneralSettingsPayload;
  portfolio: PortfolioSettingsPayload;
}

export interface SettingsReadResponse extends SettingsResponse {
  role: 'owner' | 'admin' | 'member';
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettingsPayload = {
  dateFormat: 'DD MMM YYYY',
  defaultLandingPage: '/overview',
  displayName: null,
  rowsPerPage: 20,
  timezone: 'Asia/Kolkata',
  workspaceName: 'Personal workspace',
};

export const DEFAULT_PORTFOLIO_SETTINGS: PortfolioSettingsPayload = {
  autoFetchMetadataOnCreation: true,
  automaticMetadataRefresh: 'on-open',
  criticalThresholdDays: 7,
  defaultAutoRenew: 'unknown',
  metadataSources: {
    dns: true,
    http: true,
    infra: true,
    rdap: true,
    tls: true,
  },
  warningThresholdDays: 30,
};

export const DEFAULT_DISCOVERY_SETTINGS: DiscoverySettingsPayload = {
  availabilityCheckMode: 'selected',
  defaultCheckedTlds: ['.com', '.in', '.co.in', '.ai', '.io', '.dev', '.app', '.tech'],
  defaultSearchSort: 'availability',
  savedSearchHistory: true,
};
