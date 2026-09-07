import { DomainPulseSettings, WorkspaceDataSummary } from './settings.types';

export const DEFAULT_SETTINGS: DomainPulseSettings = {
  general: {
    workspaceDisplayName: 'Aman Developer',
    workspaceName: 'Portfolio Workspace',
    defaultLandingPage: 'Overview',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD MMM YYYY',
    defaultCurrency: 'INR',
    rowsPerPage: 20,
  },
  portfolio: {
    automaticMetadataRefresh: 'on-start',
    domainMetadataSources: {
      rdap: true,
      dns: true,
      ssl: true,
    },
    relationshipDisplayMode: 'mapped',
    defaultInfrastructureView: 'inventory',
    defaultAutoRenewAssumption: 'off',
    criticalThresholdDays: 7,
    warningThresholdDays: 30,
    healthyThresholdDays: 30,
    defaultCategoryTag: 'Core Portfolio',
    autoFetchMetadataOnCreation: true,
  },
  domainDiscovery: {
    defaultCheckedTlds: ['.com', '.in', '.co.in', '.ai', '.io', '.dev', '.app', '.tech'],
    defaultDiscoveryMode: 'reference-preview',
    savedSearchHistory: true,
    defaultRegistrarComparison: 'best-value',
    domainAvailabilitySource: 'reference-dataset',
    preferredSuggestionStyle: 'brandable',
    smartNameVariations: true,
    availabilityCheckMode: 'selected',
    defaultSearchSort: 'availability',
  },
  alerts: {
    criticalThreshold: '≤ 7 days',
    warningThreshold: '8–30 days',
    healthyThreshold: '> 30 days',
    reminderIntervals: {
      thirtyDays: true,
      fifteenDays: true,
      sevenDays: true,
      threeDays: true,
      oneDay: true,
    },
    sslReminderIntervals: {
      thirtyDays: true,
      fourteenDays: true,
      sevenDays: true,
    },
    autoRenewDiscrepancyAlert: true,
    dnsResolutionCheck: true,
    channels: {
      inAppDashboard: true,
      browserPush: false,
      email: false,
      whatsapp: false,
    },
  },
  pricing: {
    defaultCurrency: 'INR',
    pricingMode: 'reference-dataset',
    defaultPricingHorizon: '5-years',
    defaultComparisonSort: 'best-value',
    includeWhoisPrivacy: true,
    includeDnssec: true,
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
  pricingMode: 'Reference Dataset',
  monitoringState: 'Not Connected',
  totalDomainsCount: 42,
  totalServersCount: 6,
  totalWebsitesCount: 18,
  totalAccountsCount: 5,
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

export const LANDING_PAGE_OPTIONS = [
  { value: 'Overview', label: 'Overview' },
  { value: 'My Domains', label: 'My Domains' },
  { value: 'VPS & Servers', label: 'VPS & Servers' },
  { value: 'Websites & Apps', label: 'Websites & Apps' },
  { value: 'Accounts & Emails', label: 'Accounts & Emails' },
  { value: 'Find Domain', label: 'Find Domain' },
  { value: 'Price Comparison', label: 'Price Comparison' },
  { value: 'Alerts & Monitoring', label: 'Alerts & Monitoring' },
  { value: 'Infrastructure Map', label: 'Infrastructure Map' },
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
