import { OverviewReferenceData } from './overview.types';

/**
 * Isolated reference data for Overview visual parity.
 *
 * NOTE:
 * - This dataset is isolated and typed.
 * - It is never stored or persisted in localStorage.
 * - Later Phase integrations will replace this reference object with an API query hook.
 */
export const OVERVIEW_REFERENCE_DATA: OverviewReferenceData = {
  metrics: {
    totalAssets: {
      count: 42,
      trend: '+3 this mo',
      trackedRatio: '42/42 (100%)',
    },
    expiringSoon: {
      count: 6,
      percentage: '14.3% of total',
      cutoffDate: 'Oct 03 cutoff',
    },
    criticalRenewals: {
      count: 2,
      statusText: 'Action required',
      nextExpiryDomain: 'worknai.com',
      nextExpiryDays: 4,
    },
    annualRunRate: {
      totalCostFormatted: '₹48,240',
      monthlyAvgFormatted: '₹4,020/mo avg',
      projected30dBurnFormatted: '₹9,048',
    },
  },

  urgentAttention: {
    title: 'Immediate Action: 2 Domains Dropping Soon',
    badge: 'LOSS PREVENTION',
    description: 'Unrenewed domains risk expiration and service loss based on stored record dates.',
    urgentDomains: [
      {
        id: 'worknai-com',
        domain: 'worknai.com',
        daysRemaining: 4,
      },
      {
        id: 'businesshub-in',
        domain: 'businesshub.in',
        daysRemaining: 6,
      },
    ],
  },

  healthMatrix: {
    totalAssets: 42,
    segments: [
      {
        status: 'healthy',
        label: 'Healthy',
        count: 34,
        percentage: 81.0,
      },
      {
        status: 'warning',
        label: 'Warning',
        count: 6,
        percentage: 14.3,
      },
      {
        status: 'critical',
        label: 'Critical',
        count: 2,
        percentage: 4.7,
      },
    ],
  },

  renewals: [
    {
      id: 'worknai-com',
      domain: 'worknai.com',
      initial: 'W',
      initialBgClass: 'bg-primary-fixed',
      initialTextClass: 'text-on-primary-fixed',
      autoRenew: false,
      registrar: 'GoDaddy',
      registrarColorClass: 'bg-secondary',
      expirationDate: '08 Sep 2026',
      daysRemaining: 4,
      costFormatted: '₹1,299',
      status: 'critical',
    },
    {
      id: 'anywork-in',
      domain: 'anywork.in',
      initial: 'A',
      initialBgClass: 'bg-secondary-container',
      initialTextClass: 'text-on-secondary-container',
      autoRenew: true,
      registrar: 'Hostinger',
      registrarColorClass: 'bg-secondary',
      expirationDate: '16 Sep 2026',
      daysRemaining: 12,
      costFormatted: '₹899',
      status: 'warning',
    },
    {
      id: 'aibos-ai',
      domain: 'aibos.ai',
      initial: 'A',
      initialBgClass: 'bg-tertiary-fixed',
      initialTextClass: 'text-on-tertiary-fixed',
      autoRenew: true,
      registrar: 'Cloudflare',
      registrarColorClass: 'bg-secondary',
      expirationDate: '03 Oct 2026',
      daysRemaining: 29,
      costFormatted: '₹6,850',
      status: 'warning',
    },
    {
      id: 'goairclass-com',
      domain: 'goairclass.com',
      initial: 'G',
      initialBgClass: 'bg-surface-container',
      initialTextClass: 'text-secondary',
      autoRenew: true,
      registrar: 'Namecheap',
      registrarColorClass: 'bg-secondary',
      expirationDate: '18 Jan 2027',
      daysRemaining: 136,
      costFormatted: '₹1,199',
      status: 'healthy',
    },
  ],

  forecast: {
    totalFormatted: '₹36,198',
    averageFormatted: 'AVG ₹6.0k',
    peakMonthText: 'Peak month: Jan (₹11.5k)',
    autoRenewCountText: '9 auto-renew enabled',
    months: [
      {
        month: 'Sep',
        amount: 9048,
        formattedAmount: '9.0k',
        barHeight: 52,
        yPosition: 32,
        colorClass: 'fill-primary-container hover:fill-primary',
      },
      {
        month: 'Oct',
        amount: 6850,
        formattedAmount: '6.8k',
        barHeight: 40,
        yPosition: 44,
        colorClass: 'fill-secondary-container hover:fill-primary',
      },
      {
        month: 'Nov',
        amount: 2400,
        formattedAmount: '2.4k',
        barHeight: 14,
        yPosition: 70,
        colorClass: 'fill-surface-container hover:fill-primary',
      },
      {
        month: 'Dec',
        amount: 4200,
        formattedAmount: '4.2k',
        barHeight: 24,
        yPosition: 60,
        colorClass: 'fill-surface-container hover:fill-primary',
      },
      {
        month: 'Jan',
        amount: 11500,
        formattedAmount: '11.5k',
        barHeight: 66,
        yPosition: 18,
        isPeak: true,
        colorClass: 'fill-primary hover:fill-tertiary',
      },
      {
        month: 'Feb',
        amount: 2200,
        formattedAmount: '2.2k',
        barHeight: 12,
        yPosition: 72,
        colorClass: 'fill-surface-container hover:fill-primary',
      },
    ],
  },

  tldComposition: {
    extensionCount: 6,
    highestValuationTld: '.ai',
    averageAnnualCostFormatted: 'Avg ₹4,920/yr',
    items: [
      {
        tld: '.com',
        count: 18,
        percentage: 42.8,
        colorClass: 'bg-primary',
      },
      {
        tld: '.in',
        count: 10,
        percentage: 23.8,
        colorClass: 'bg-primary-container',
      },
      {
        tld: '.ai',
        count: 5,
        percentage: 11.9,
        colorClass: 'bg-tertiary-container',
      },
      {
        tld: '.io',
        count: 4,
        percentage: 9.5,
        colorClass: 'bg-secondary-container',
      },
      {
        tld: '.org / other',
        count: 5,
        percentage: 11.9,
        colorClass: 'bg-secondary-fixed-dim',
      },
    ],
  },

  registrarDiversity: {
    registrarCount: 5,
    consolidationScore: 'Moderate',
    items: [
      {
        name: 'GoDaddy',
        count: 12,
        percentage: 28.5,
        colorClass: 'bg-primary',
      },
      {
        name: 'Cloudflare',
        count: 10,
        percentage: 23.8,
        colorClass: 'bg-tertiary',
      },
      {
        name: 'Namecheap',
        count: 8,
        percentage: 19.0,
        colorClass: 'bg-primary-container',
      },
      {
        name: 'Hostinger',
        count: 7,
        percentage: 16.7,
        colorClass: 'bg-secondary',
      },
      {
        name: 'Porkbun',
        count: 5,
        percentage: 11.9,
        colorClass: 'bg-secondary-container',
      },
    ],
  },
};
