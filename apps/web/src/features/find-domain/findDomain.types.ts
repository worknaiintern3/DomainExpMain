export type DomainAvailabilityStatus = 'available' | 'registered';

export interface TldAvailabilityItem {
  id: string;
  domain: string;
  tld: string;
  status: DomainAvailabilityStatus;
  statusLabel: string;
  firstYearPrice?: number;
  firstYearPriceFormatted?: string;
  renewalPrice?: number;
  renewalPriceFormatted?: string;
  renewalHikeFormatted?: string;
  renewalHikeIsWarning?: boolean;
  bestRegistrar?: string;
  bestRegistrarBadge?: string;
  topPickTag?: string;
  isSaved?: boolean;
}

export interface SmartSuggestionItem {
  id: string;
  domain: string;
  status: DomainAvailabilityStatus;
  priceFormatted: string;
  registrarHint: string;
  isSaved?: boolean;
}

export interface SynthesizerSuggestion {
  id: string;
  domain: string;
  priceFormatted: string;
  tone: string;
}

export interface RegistrarPriceQuote {
  id: string;
  registrarName: string;
  tag?: string;
  tagColor?: string;
  featureNote: string;
  firstYearPrice: number;
  firstYearFormatted: string;
  renewalFormatted: string;
  renewalHikeNote?: string;
}

export interface DomainInspectionDetails {
  domain: string;
  status: DomainAvailabilityStatus;
  statusBadgeText: string;
  sponsoringRegistrar: string;
  registrationDateFormatted?: string;
  expirationDateFormatted?: string;
  expirationDaysRemaining?: number;
  lastUpdateFormatted?: string;
  authoritativeNameservers: string[];
  dnssecValidation: string;
  dnssecStatus: 'signed' | 'unsigned';
  whoisPrivacy: string;
  registryDomainId?: string;
  icannStatusFlags: string[];
  operationalNotice?: string;
}

export interface WatchlistItem {
  id: string;
  domain: string;
  status: DomainAvailabilityStatus;
  priceFormatted: string;
  registrarNote: string;
}

export type SearchState = 'results' | 'loading' | 'empty';

export interface FindDomainSummary {
  activeQuery: string;
  extensionsCheckedCount: number;
  availableCount: number;
  registeredCount: number;
  lowestRegPriceFormatted: string;
  lowestRegDetails: string;
}
