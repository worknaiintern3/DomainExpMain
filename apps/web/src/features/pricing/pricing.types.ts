import type { DomainAvailabilityProvider } from '@/api/domain-search';

export type HorizonYears = 1 | 3 | 5;

export type PricingSortOption =
  | 'lowest-first-year'
  | 'lowest-renewal'
  | 'lowest-transfer'
  | 'lowest-5yr';

/** Lifecycle of the live registrar comparison request. */
export type PricingSearchState = 'idle' | 'loading' | 'results' | 'error';

export type PriceField = 'registration' | 'renewal' | 'transfer';

/** The lowest value of one price field within a single currency. */
export interface CurrencyLowest {
  currency: string;
  minorUnits: number;
  providers: DomainAvailabilityProvider[];
}

/** Ownership cost for one provider over a horizon, in that provider's own currency. */
export interface OwnershipCostItem {
  provider: DomainAvailabilityProvider;
  currency: string;
  year1MinorUnits: number;
  renewalMinorUnits: number;
  totalMinorUnits: number;
  isLowestInCurrency: boolean;
}

/** Spread between the cheapest and dearest total within one currency. */
export interface OwnershipSavings {
  currency: string;
  savingsMinorUnits: number;
  /** Tenths of a percent (e.g. 123 = 12.3%). */
  savingsTenthsPercent: number;
}

export interface TransferSavingsCalculation {
  currentAnnualMinorUnits: number;
  projectedAnnualMinorUnits: number;
  annualSavingsMinorUnits: number;
  threeYearSavingsMinorUnits: number;
  percentSavings: number;
}
