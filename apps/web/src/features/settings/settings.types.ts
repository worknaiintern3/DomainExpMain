import type {
  DiscoverySettingsPayload,
  LandingPage,
  PortfolioSettingsPayload,
} from '@/api/settings';
import type { DateFormatPattern } from '@/lib/format';

export type SettingsCategory =
  | 'general'
  | 'portfolio'
  | 'domain-discovery'
  | 'alerts'
  | 'pricing'
  | 'appearance'
  | 'integrations'
  | 'data-management';

export type SaveState = 'saved' | 'unsaved' | 'saving' | 'error';

export interface GeneralSettings {
  /** Saved to `users.display_name`; shown in the sidebar. */
  displayName: string;
  /** Saved to `workspaces.name`; shown in the sidebar and headers. */
  workspaceName: string;
  defaultLandingPage: LandingPage;
  timezone: string;
  dateFormat: DateFormatPattern;
  rowsPerPage: 20 | 50 | 100;
}

export type PortfolioSettings = PortfolioSettingsPayload;

export type DomainDiscoverySettings = DiscoverySettingsPayload;

export interface PricingCurrencySettings {
  defaultCurrency: string;
  pricingMode: 'live-registrar-apis';
  defaultPricingHorizon: '1-year' | '3-years' | '5-years';
  defaultComparisonSort: 'best-value' | 'lowest-renewal' | 'lowest-first-year';
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
}

export interface DomainPulseSettings {
  general: GeneralSettings;
  portfolio: PortfolioSettings;
  domainDiscovery: DomainDiscoverySettings;
  pricing: PricingCurrencySettings;
  appearance: AppearanceSettings;
}
