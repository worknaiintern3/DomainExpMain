import type { LandingPage } from '@/api/settings';
import { DomainPulseSettings, WorkspaceDataSummary } from './settings.types';

export const DEFAULT_SETTINGS: DomainPulseSettings = {
  general: {
    displayName: '',
    workspaceName: 'Personal workspace',
    defaultLandingPage: '/overview',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD MMM YYYY',
    rowsPerPage: 20,
  },
  portfolio: {
    autoFetchMetadataOnCreation: true,
    automaticMetadataRefresh: 'on-open',
    criticalThresholdDays: 7,
    defaultAutoRenew: 'unknown',
    metadataSources: { dns: true, http: true, infra: true, rdap: true, tls: true },
    warningThresholdDays: 30,
  },
  domainDiscovery: {
    availabilityCheckMode: 'selected',
    defaultCheckedTlds: ['.com', '.in', '.co.in', '.ai', '.io', '.dev', '.app', '.tech'],
    defaultSearchSort: 'availability',
    savedSearchHistory: true,
  },
  pricing: {
    defaultCurrency: 'INR',
    pricingMode: 'live-registrar-apis',
    defaultPricingHorizon: '5-years',
    defaultComparisonSort: 'best-value',
    renewalMarkupThreshold: 50,
    showRegistrationPriceColumn: true,
    showRenewalPriceColumn: true,
    showTransferPriceColumn: true,
  },
  appearance: {
    theme: 'light',
    density: 'compact',
    sidebar: 'expanded',
    tableRowDensity: 'compact',
    monoDataFont: 'JetBrains Mono',
    interfaceFont: 'Inter',
    microInteractions: true,
    respectReducedMotion: false,
  },
};

export const WORKSPACE_SUMMARY_DATA: WorkspaceDataSummary = {
  storage: 'Portfolio Workspace',
  domainDataSources: 'RDAP / DNS / SSL',
  pricingMode: 'Live Registrar APIs',
};

export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST +05:30)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'America/New_York (EST / EDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST / PDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT / BST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET / CEST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT +08:00)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST +09:00)' },
];

export const DATE_FORMAT_OPTIONS = [
  { value: 'DD MMM YYYY', label: 'DD MMM YYYY (e.g., 24 Oct 2026)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO standard)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US standard)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (UK / India standard)' },
];

export const CURRENCY_OPTIONS = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', label: 'INR (₹) - Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar', label: 'USD ($) - US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro', label: 'EUR (€) - Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound', label: 'GBP (£) - British Pound' },
];

export const LANDING_PAGE_OPTIONS: ReadonlyArray<{ value: LandingPage; label: string }> = [
  { value: '/overview', label: 'Overview' },
  { value: '/domains', label: 'My Domains' },
  { value: '/servers', label: 'VPS & Servers' },
  { value: '/websites', label: 'Websites & Apps' },
  { value: '/projects', label: 'Projects' },
  { value: '/cloud-resources', label: 'Cloud Resources' },
  { value: '/accounts', label: 'Accounts & Emails' },
  { value: '/find-domain', label: 'Find Domain' },
  { value: '/pricing', label: 'Price Comparison' },
  { value: '/alerts', label: 'Alerts & Monitoring' },
  { value: '/activities', label: 'Recent Activity' },
  { value: '/notifications', label: 'Notifications' },
  { value: '/infrastructure-map', label: 'Infrastructure Map' },
  { value: '/google-play', label: 'Google Play Console' },
  { value: '/play-store', label: 'Play Store' },
];

export const AVAILABLE_TLDS = [
  '.com',
  '.in',
  '.co.in',
  '.ai',
  '.io',
  '.dev',
  '.app',
  '.tech',
  '.net',
  '.org',
  '.cloud',
  '.co',
];
