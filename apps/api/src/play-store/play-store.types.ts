export interface DeveloperSearchResult {
  id: string;
  name: string;
  icon?: string | undefined;
  sampleApps: string[];
  appCount: number;
  verified: boolean;
}

export interface PlayStoreAppItem {
  id: string;
  name: string;
  packageId: string;
  developerName: string;
  developerId?: string | undefined;
  iconUrl?: string | undefined;
  playStoreUrl: string;
  summary?: string | undefined;
  score?: number | undefined;
  scoreText?: string | undefined;
  price?: string | number | undefined;
  free?: boolean | undefined;
  currency?: string | undefined;
}

export interface DeveloperSearchResponse {
  query: string;
  total: number;
  developers: DeveloperSearchResult[];
}

export interface DeveloperAppsResponse {
  developerId: string;
  developerName: string;
  total: number;
  apps: PlayStoreAppItem[];
}
