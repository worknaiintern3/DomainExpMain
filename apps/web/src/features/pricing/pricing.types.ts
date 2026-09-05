export type PricingMode = 'registrars' | 'hosting';

export type PricingSource = 'Reference Dataset' | 'Stored Pricing';

export type HorizonYears = 1 | 3 | 5;

export type HostingCategory =
  | 'all'
  | 'shared'
  | 'wordpress'
  | 'vps'
  | 'cloud'
  | 'serverless';

export type PricingSortOption =
  | 'best-value'
  | 'lowest-first-year'
  | 'lowest-renewal'
  | 'lowest-transfer'
  | 'lowest-5yr';

export interface RegistrarPricing {
  id: string;
  registrarName: string;
  icon: string;
  icannId?: string;
  tld: string;
  registrationPrice: number;
  registrationFormatted: string;
  renewalPrice: number;
  renewalFormatted: string;
  transferPrice: number;
  transferFormatted: string;
  currency: 'INR';
  hikePercent: number;
  hikeLabel: string;
  hikeIsWarning: boolean;
  privacyIncluded: boolean;
  privacyLabel: string;
  privacyIsUpsell?: boolean;
  dnssecSupported: boolean;
  score: number;
  topTag?: string;
  tagVariant?: 'best' | 'warning' | 'neutral' | 'primary' | 'wholesale';
  tagline: string;
  pricingSource: PricingSource;
  supportedPayments: string;
  supportChannels: string;
  notes?: string;
}

export interface HostingProviderPricing {
  id: string;
  providerName: string;
  tierName: string;
  icon: string;
  category: HostingCategory;
  monthlyEffective: number;
  monthlyFormatted: string;
  annualBilled: number;
  annualFormatted: string;
  renewalMonthly?: number;
  renewalMonthlyFormatted?: string;
  storage: string;
  bandwidth: string;
  sslAndDomain: string;
  datacenters: string;
  refundPolicy: string;
  verdict: string;
  verdictVariant: 'best' | 'warning' | 'primary' | 'neutral';
  renewalHikeWarning?: boolean;
  regions: string[];
}

export interface PricingSummaryMetrics {
  lowestRegPrice: number;
  lowestRegFormatted: string;
  lowestRegProvider: string;
  lowestRenPrice: number;
  lowestRenFormatted: string;
  lowestRenProvider: string;
  lowestTransPrice: number;
  lowestTransFormatted: string;
  lowestTransProvider: string;
  registrarsCount: number;
  industryAvgRenewal: number;
  industryAvgRenewalFormatted: string;
  markupAlertCount: number;
  markupAlertNote: string;
}

export interface OwnershipCostItem {
  registrarId: string;
  registrarName: string;
  icon: string;
  tagline: string;
  badge?: string;
  badgeVariant?: 'best' | 'warning' | 'neutral' | 'primary';
  year1Cost: number;
  renewalAnnualCost: number;
  calculatedTotalCost: number;
  calculatedTotalFormatted: string;
  year1Formatted: string;
  year1Percent: number;
  renewalPercent: number;
  isBestValue?: boolean;
  isMarkupSpike?: boolean;
}

export interface TransferCalculationResult {
  currentAnnual: number;
  projectedAnnual: number;
  annualSavings: number;
  threeYearSavings: number;
  percentSavings: number;
  currentAnnualFormatted: string;
  projectedAnnualFormatted: string;
  annualSavingsFormatted: string;
  threeYearSavingsFormatted: string;
}

export interface SavedComparisonItem {
  id: string;
  title: string;
  tld: string;
  date: string;
  topPick: string;
  est5YrSavings: string;
}
