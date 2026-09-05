export type HealthStatus = 'healthy' | 'warning' | 'critical';

export interface OverviewMetrics {
  totalAssets: {
    count: number;
    trend: string;
    trackedRatio: string;
  };
  expiringSoon: {
    count: number;
    percentage: string;
    cutoffDate: string;
  };
  criticalRenewals: {
    count: number;
    statusText: string;
    nextExpiryDomain: string;
    nextExpiryDays: number;
  };
  annualRunRate: {
    totalCostFormatted: string;
    monthlyAvgFormatted: string;
    projected30dBurnFormatted: string;
  };
}

export interface UrgentRenewalItem {
  id: string;
  domain: string;
  daysRemaining: number;
}

export interface UrgentAttentionData {
  title: string;
  badge: string;
  description: string;
  urgentDomains: UrgentRenewalItem[];
}

export interface HealthMatrixSegment {
  status: HealthStatus;
  label: string;
  count: number;
  percentage: number;
}

export interface HealthMatrixData {
  totalAssets: number;
  segments: HealthMatrixSegment[];
}

export interface RenewalTableRow {
  id: string;
  domain: string;
  initial: string;
  initialBgClass: string;
  initialTextClass: string;
  autoRenew: boolean;
  registrar: string;
  registrarColorClass: string;
  expirationDate: string;
  daysRemaining: number;
  costFormatted: string;
  status: HealthStatus;
}

export interface ForecastMonth {
  month: string;
  amount: number;
  formattedAmount: string;
  barHeight: number; // SVG bar height
  yPosition: number; // SVG y position
  isPeak?: boolean;
  colorClass: string;
}

export interface RenewalForecastData {
  totalFormatted: string;
  averageFormatted: string;
  peakMonthText: string;
  autoRenewCountText: string;
  months: ForecastMonth[];
}

export interface TldItem {
  tld: string;
  count: number;
  percentage: number;
  colorClass: string;
}

export interface TldCompositionData {
  extensionCount: number;
  highestValuationTld: string;
  averageAnnualCostFormatted: string;
  items: TldItem[];
}

export interface RegistrarItem {
  name: string;
  count: number;
  percentage: number;
  colorClass: string;
}

export interface RegistrarDiversityData {
  registrarCount: number;
  consolidationScore: string;
  items: RegistrarItem[];
}

export interface OverviewReferenceData {
  metrics: OverviewMetrics;
  urgentAttention: UrgentAttentionData;
  healthMatrix: HealthMatrixData;
  renewals: RenewalTableRow[];
  forecast: RenewalForecastData;
  tldComposition: TldCompositionData;
  registrarDiversity: RegistrarDiversityData;
}
