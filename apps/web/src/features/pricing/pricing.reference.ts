import {
  RegistrarPricing,
  HostingProviderPricing,
  PricingSummaryMetrics,
  OwnershipCostItem,
  TransferCalculationResult,
  SavedComparisonItem,
  HorizonYears,
} from './pricing.types';

export const SUPPORTED_PRICING_TLDS: string[] = [
  '.com',
  '.in',
  '.co.in',
  '.ai',
  '.io',
  '.org',
  '.net',
  '.co',
  '.dev',
  '.app',
  '.tech',
];

export const INITIAL_SAVED_COMPARISONS: SavedComparisonItem[] = [
  {
    id: 'sc-1',
    title: '.com Portfolio Optimization',
    tld: '.com',
    date: '04 Sep 2026',
    topPick: 'Cloudflare Registrar',
    est5YrSavings: '₹2,200/domain',
  },
  {
    id: 'sc-2',
    title: '.in National Tech Brands',
    tld: '.in',
    date: '02 Sep 2026',
    topPick: 'Hostinger (Lowest Reg)',
    est5YrSavings: '₹1,500/domain',
  },
  {
    id: 'sc-3',
    title: '.ai Next-Gen Startup Suite',
    tld: '.ai',
    date: '28 Aug 2026',
    topPick: 'Cloudflare At-Cost',
    est5YrSavings: '₹4,800/domain',
  },
  {
    id: 'sc-4',
    title: '.io Infrastructure Stack',
    tld: '.io',
    date: '20 Aug 2026',
    topPick: 'Porkbun LLC',
    est5YrSavings: '₹2,800/domain',
  },
];

export const COM_REGISTRAR_PRICING: RegistrarPricing[] = [
  {
    id: 'cloudflare',
    registrarName: 'Cloudflare',
    icon: 'cloud',
    icannId: 'ICANN #1479',
    tld: '.com',
    registrationPrice: 899,
    registrationFormatted: '₹899',
    renewalPrice: 899,
    renewalFormatted: '₹899',
    transferPrice: 899,
    transferFormatted: '₹899',
    currency: 'INR',
    hikePercent: 0,
    hikeLabel: 'Flat (0%)',
    hikeIsWarning: false,
    privacyIncluded: true,
    privacyLabel: 'Free Lifetime',
    dnssecSupported: true,
    score: 9.8,
    topTag: 'Best Long-Term',
    tagVariant: 'best',
    tagline: 'ICANN #1479 • At-Cost Wholesale',
    pricingSource: 'Reference Dataset',
    supportedPayments: 'Credit Card, PayPal, Apple Pay',
    supportChannels: 'Community, Ticket, Enterprise SLA',
    notes: 'Zero-markup wholesale domain registration. Requires Cloudflare authoritative DNS.',
  },
  {
    id: 'porkbun',
    registrarName: 'Porkbun LLC',
    icon: 'savings',
    icannId: 'ICANN #1861',
    tld: '.com',
    registrationPrice: 849,
    registrationFormatted: '₹849',
    renewalPrice: 950,
    renewalFormatted: '₹950',
    transferPrice: 749,
    transferFormatted: '₹749',
    currency: 'INR',
    hikePercent: 12,
    hikeLabel: '+12%',
    hikeIsWarning: false,
    privacyIncluded: true,
    privacyLabel: 'Free Lifetime',
    dnssecSupported: true,
    score: 9.5,
    topTag: 'Lowest Transfer',
    tagVariant: 'primary',
    tagline: 'Accredited ICANN #1861 • Reference Comparison Profile',
    pricingSource: 'Reference Dataset',
    supportedPayments: 'Card, PayPal, Crypto, AliPay',
    supportChannels: 'Email Ticket, Live Chat (US Hours)',
    notes: 'Transparent ICANN wholesale fees with lowest transfer friction in benchmark.',
  },
  {
    id: 'namecheap',
    registrarName: 'Namecheap',
    icon: 'tag',
    icannId: 'ICANN #1068',
    tld: '.com',
    registrationPrice: 799,
    registrationFormatted: '₹799',
    renewalPrice: 1099,
    renewalFormatted: '₹1,099',
    transferPrice: 899,
    transferFormatted: '₹899',
    currency: 'INR',
    hikePercent: 37,
    hikeLabel: '+37%',
    hikeIsWarning: false,
    privacyIncluded: true,
    privacyLabel: 'Free Lifetime',
    dnssecSupported: true,
    score: 8.9,
    topTag: 'Popular',
    tagVariant: 'neutral',
    tagline: 'ICANN #1068 • Popular Global Registrar',
    pricingSource: 'Reference Dataset',
    supportedPayments: 'Card, PayPal, Bitcoin, UPI via partners',
    supportChannels: '24/7 Live Chat, Knowledge Base',
    notes: 'Free lifetime WhoisGuard privacy with standard renewal tiers.',
  },
  {
    id: 'hostinger',
    registrarName: 'Hostinger',
    icon: 'rocket_launch',
    icannId: 'ICANN #1636',
    tld: '.com',
    registrationPrice: 699,
    registrationFormatted: '₹699',
    renewalPrice: 1299,
    renewalFormatted: '₹1,299',
    transferPrice: 849,
    transferFormatted: '₹849',
    currency: 'INR',
    hikePercent: 85,
    hikeLabel: '⚠️ +85%',
    hikeIsWarning: true,
    privacyIncluded: true,
    privacyLabel: 'Free Lifetime',
    dnssecSupported: true,
    score: 7.8,
    topTag: 'Best 1st-Year',
    tagVariant: 'warning',
    tagline: 'ICANN #1636 • Promotional Aggressive Pricing',
    pricingSource: 'Reference Dataset',
    supportedPayments: 'UPI, NetBanking, Cards, Paytm, PayPal',
    supportChannels: '24/7 Multi-lingual Chat Support',
    notes: 'Aggressive introductory first-year pricing with significant renewal increment.',
  },
  {
    id: 'dynadot',
    registrarName: 'Dynadot',
    icon: 'storefront',
    icannId: 'ICANN #472',
    tld: '.com',
    registrationPrice: 789,
    registrationFormatted: '₹789',
    renewalPrice: 999,
    renewalFormatted: '₹999',
    transferPrice: 799,
    transferFormatted: '₹799',
    currency: 'INR',
    hikePercent: 26,
    hikeLabel: '+26%',
    hikeIsWarning: false,
    privacyIncluded: true,
    privacyLabel: 'Free Lifetime',
    dnssecSupported: true,
    score: 9.1,
    topTag: 'Wholesale',
    tagVariant: 'wholesale',
    tagline: 'ICANN #472 • Wholesale Margin Structure',
    pricingSource: 'Reference Dataset',
    supportedPayments: 'Card, PayPal, Wire, Alipay, Skrill',
    supportChannels: 'Live Chat, Phone, Forum Support',
    notes: 'Low-spread bulk and retail domain broker with free domain parking & forwarding.',
  },
  {
    id: 'aws',
    registrarName: 'AWS Route 53',
    icon: 'hub',
    icannId: 'Amazon Registrar',
    tld: '.com',
    registrationPrice: 1150,
    registrationFormatted: '₹1,150',
    renewalPrice: 1150,
    renewalFormatted: '₹1,150',
    transferPrice: 1150,
    transferFormatted: '₹1,150',
    currency: 'INR',
    hikePercent: 0,
    hikeLabel: 'Flat (0%)',
    hikeIsWarning: false,
    privacyIncluded: true,
    privacyLabel: 'Free Lifetime',
    dnssecSupported: true,
    score: 8.4,
    topTag: 'Enterprise',
    tagVariant: 'neutral',
    tagline: 'Amazon Infrastructure • Enterprise DNS',
    pricingSource: 'Reference Dataset',
    supportedPayments: 'AWS Consolidated Billing / Cards',
    supportChannels: 'AWS Support Plans (Developer / Business)',
    notes: 'Direct integration with AWS IAM, CloudFront, Route 53 hosted zones and VPC.',
  },
  {
    id: 'squarespace',
    registrarName: 'Squarespace',
    icon: 'web',
    icannId: 'ex-Google Domains',
    tld: '.com',
    registrationPrice: 1650,
    registrationFormatted: '₹1,650',
    renewalPrice: 1650,
    renewalFormatted: '₹1,650',
    transferPrice: 1650,
    transferFormatted: '₹1,650',
    currency: 'INR',
    hikePercent: 0,
    hikeLabel: 'Flat (0%)',
    hikeIsWarning: false,
    privacyIncluded: true,
    privacyLabel: 'Free Lifetime',
    dnssecSupported: true,
    score: 7.2,
    topTag: 'Bundle',
    tagVariant: 'neutral',
    tagline: 'Squarespace Domains • ex-Google Domains',
    pricingSource: 'Reference Dataset',
    supportedPayments: 'Credit Card, PayPal, Apple Pay',
    supportChannels: '24/7 Email, Live Chat (Mon-Fri)',
    notes: 'Flat bundled rate following migration of Google Domains assets.',
  },
  {
    id: 'godaddy',
    registrarName: 'GoDaddy',
    icon: 'warning',
    icannId: 'ICANN #146',
    tld: '.com',
    registrationPrice: 499,
    registrationFormatted: '₹499',
    renewalPrice: 1499,
    renewalFormatted: '₹1,499',
    transferPrice: 1299,
    transferFormatted: '₹1,299',
    currency: 'INR',
    hikePercent: 200,
    hikeLabel: 'High Renewal Increase (+200%)',
    hikeIsWarning: true,
    privacyIncluded: false,
    privacyLabel: 'Upsell (₹299/yr)',
    privacyIsUpsell: true,
    dnssecSupported: false,
    score: 5.8,
    topTag: 'Markup Risk',
    tagVariant: 'warning',
    tagline: 'ICANN #146 • Deep Promotional First-Year Markup',
    pricingSource: 'Reference Dataset',
    supportedPayments: 'UPI, Cards, NetBanking, Wallets',
    supportChannels: '24/7 Phone Support (India), Chat',
    notes: 'High renewal markup after promotional year 1. Additional fee for WHOIS privacy.',
  },
];

export const HOSTING_PROVIDERS_PRICING: HostingProviderPricing[] = [
  {
    id: 'hostinger-cloud',
    providerName: 'Hostinger',
    tierName: 'Cloud Startup (100 Sites)',
    icon: 'cloud',
    category: 'cloud',
    monthlyEffective: 799,
    monthlyFormatted: '₹799/mo',
    annualBilled: 9588,
    annualFormatted: '₹9,588/yr',
    storage: '200 GB NVMe',
    bandwidth: 'Unlimited BW',
    sslAndDomain: 'Free SSL + Free 1st Yr Domain',
    datacenters: 'India, Singapore, US, UK',
    refundPolicy: '30-day money-back',
    verdict: 'Best for India',
    verdictVariant: 'best',
    regions: ['India', 'Singapore', 'US', 'EU'],
  },
  {
    id: 'do-droplet',
    providerName: 'DigitalOcean',
    tierName: 'Basic Droplet (1 vCPU, 1GB)',
    icon: 'memory',
    category: 'vps',
    monthlyEffective: 499,
    monthlyFormatted: '₹499/mo',
    annualBilled: 5988,
    annualFormatted: '₹5,988/yr',
    storage: '25 GB SSD',
    bandwidth: '1 TB Transfer',
    sslAndDomain: "Let's Encrypt / Bring Own",
    datacenters: 'Bangalore (BLR1), Singapore, NYC',
    refundPolicy: 'Hourly billing (pay-as-you-go)',
    verdict: 'Best Developer',
    verdictVariant: 'neutral',
    regions: ['India', 'Singapore', 'US'],
  },
  {
    id: 'vultr-nvme',
    providerName: 'Vultr',
    tierName: 'High Performance NVMe',
    icon: 'speed',
    category: 'vps',
    monthlyEffective: 520,
    monthlyFormatted: '₹520/mo',
    annualBilled: 6240,
    annualFormatted: '₹6,240/yr',
    storage: '32 GB NVMe',
    bandwidth: '1 TB Transfer',
    sslAndDomain: 'Free Auto SSL',
    datacenters: 'Mumbai, Delhi NCR, Singapore',
    refundPolicy: 'Hourly usage metering',
    verdict: 'Best VPS Value',
    verdictVariant: 'neutral',
    regions: ['India', 'Singapore'],
  },
  {
    id: 'aws-lightsail',
    providerName: 'AWS Lightsail',
    tierName: 'Entry Bundle (ap-south-1)',
    icon: 'hub',
    category: 'cloud',
    monthlyEffective: 290,
    monthlyFormatted: '₹290/mo',
    annualBilled: 3480,
    annualFormatted: '₹3,480/yr',
    storage: '20 GB SSD',
    bandwidth: '1 TB Transfer',
    sslAndDomain: 'AWS Certificate Manager',
    datacenters: 'Mumbai (ap-south-1)',
    refundPolicy: '3-Month Free Tier eligible',
    verdict: 'Lowest Cost',
    verdictVariant: 'primary',
    regions: ['India'],
  },
  {
    id: 'siteground-growbig',
    providerName: 'SiteGround',
    tierName: 'GrowBig (Promo Tier)',
    icon: 'warning',
    category: 'shared',
    monthlyEffective: 899,
    monthlyFormatted: '₹899 → ₹2,499 ren',
    annualBilled: 10788,
    annualFormatted: '₹10,788/yr',
    renewalMonthly: 2499,
    renewalMonthlyFormatted: '₹2,499/mo',
    storage: '20 GB Web Space',
    bandwidth: 'Unmetered Traffic',
    sslAndDomain: 'High Renewal Increase (+200%)',
    datacenters: 'Singapore, Frankfurt, London',
    refundPolicy: '30-day guarantee',
    verdict: '⚠️ Renewal Hike',
    verdictVariant: 'warning',
    renewalHikeWarning: true,
    regions: ['Singapore', 'EU'],
  },
  {
    id: 'cloudways-do',
    providerName: 'Cloudways',
    tierName: 'DO Managed Cloud (1GB RAM)',
    icon: 'cloud_done',
    category: 'cloud',
    monthlyEffective: 1150,
    monthlyFormatted: '₹1,150/mo',
    annualBilled: 13800,
    annualFormatted: '₹13,800/yr',
    storage: '25 GB SSD',
    bandwidth: '1 TB Transfer',
    sslAndDomain: 'Free 1-Click SSL',
    datacenters: '65+ Global Datacenters',
    refundPolicy: '3-day free trial',
    verdict: 'Managed Stack',
    verdictVariant: 'neutral',
    regions: ['India', 'Singapore', 'US', 'EU'],
  },
];

export function getRegistrarsForTld(tld: string): RegistrarPricing[] {
  if (tld === '.com') {
    return COM_REGISTRAR_PRICING;
  }

  // Base pricing multipliers and variations per TLD
  const isAi = tld === '.ai';
  const isIo = tld === '.io';
  const isDev = tld === '.dev' || tld === '.app';
  const isIn = tld === '.in' || tld === '.co.in';
  const isTech = tld === '.tech';

  const baseMulti = isAi ? 6.5 : isIo ? 3.0 : isDev ? 1.3 : isIn ? 0.8 : isTech ? 0.6 : 1.0;

  return COM_REGISTRAR_PRICING.map((reg) => {
    let regPrice = Math.round((reg.registrationPrice * baseMulti) / 10) * 10;
    let renPrice = Math.round((reg.renewalPrice * baseMulti) / 10) * 10;
    let transPrice = Math.round((reg.transferPrice * baseMulti) / 10) * 10;

    // Special case adjustments for realism
    if (isIn && reg.id === 'hostinger') {
      regPrice = 499;
      renPrice = 799;
    } else if (isIn && reg.id === 'namecheap') {
      regPrice = 599;
      renPrice = 899;
    } else if (isAi && reg.id === 'cloudflare') {
      regPrice = 5799;
      renPrice = 5799;
      transPrice = 5799;
    } else if (isAi && reg.id === 'godaddy') {
      regPrice = 6499;
      renPrice = 8999;
    }

    const hikePercent = Math.max(0, Math.round(((renPrice - regPrice) / regPrice) * 100));
    const hikeIsWarning = hikePercent >= 50;
    const hikeLabel =
      hikePercent === 0
        ? 'Flat (0%)'
        : hikePercent > 100
        ? `High Renewal Increase (+${hikePercent}%)`
        : `+${hikePercent}%`;

    return {
      ...reg,
      tld,
      registrationPrice: regPrice,
      registrationFormatted: `₹${regPrice.toLocaleString('en-IN')}`,
      renewalPrice: renPrice,
      renewalFormatted: `₹${renPrice.toLocaleString('en-IN')}`,
      transferPrice: transPrice,
      transferFormatted: `₹${transPrice.toLocaleString('en-IN')}`,
      hikePercent,
      hikeLabel,
      hikeIsWarning,
    };
  });
}

export function calculatePricingSummary(registrars: RegistrarPricing[]): PricingSummaryMetrics {
  if (registrars.length === 0) {
    return {
      lowestRegPrice: 0,
      lowestRegFormatted: '₹0',
      lowestRegProvider: '—',
      lowestRenPrice: 0,
      lowestRenFormatted: '₹0',
      lowestRenProvider: '—',
      lowestTransPrice: 0,
      lowestTransFormatted: '₹0',
      lowestTransProvider: '—',
      registrarsCount: 0,
      industryAvgRenewal: 0,
      industryAvgRenewalFormatted: '₹0',
      markupAlertCount: 0,
      markupAlertNote: 'None',
    };
  }

  const sortedByReg = [...registrars].sort((a, b) => a.registrationPrice - b.registrationPrice);
  const sortedByRen = [...registrars].sort((a, b) => a.renewalPrice - b.renewalPrice);
  const sortedByTrans = [...registrars].sort((a, b) => a.transferPrice - b.transferPrice);

  const lowestReg = sortedByReg[0];
  const lowestRen = sortedByRen[0];
  const lowestTrans = sortedByTrans[0];

  const totalRenewal = registrars.reduce((sum, r) => sum + r.renewalPrice, 0);
  const avgRenewal = Math.round(totalRenewal / registrars.length);

  const markupHikes = registrars.filter((r) => r.hikePercent >= 75);

  return {
    lowestRegPrice: lowestReg.registrationPrice,
    lowestRegFormatted: lowestReg.registrationFormatted,
    lowestRegProvider: `${lowestReg.registrarName} ${lowestReg.topTag ? `(${lowestReg.topTag})` : ''}`.trim(),
    lowestRenPrice: lowestRen.renewalPrice,
    lowestRenFormatted: lowestRen.renewalFormatted,
    lowestRenProvider: `${lowestRen.registrarName} (At-Cost)`,
    lowestTransPrice: lowestTrans.transferPrice,
    lowestTransFormatted: lowestTrans.transferFormatted,
    lowestTransProvider: lowestTrans.registrarName,
    registrarsCount: registrars.length,
    industryAvgRenewal: avgRenewal,
    industryAvgRenewalFormatted: `₹${avgRenewal.toLocaleString('en-IN')}`,
    markupAlertCount: markupHikes.length,
    markupAlertNote: `Providers hike renewals >75%`,
  };
}

export function calculateOwnershipCosts(
  registrars: RegistrarPricing[],
  horizonYears: HorizonYears = 5
): OwnershipCostItem[] {
  // Focus on top representative providers
  const keyProviderIds = ['cloudflare', 'porkbun', 'namecheap', 'godaddy'];
  const targets = registrars.filter((r) => keyProviderIds.includes(r.id));
  const items = targets.length > 0 ? targets : registrars.slice(0, 4);

  return items.map((reg) => {
    const year1 = reg.registrationPrice;
    const renewalYears = horizonYears - 1;
    const totalRenewal = renewalYears * reg.renewalPrice;
    const calculatedTotal = year1 + totalRenewal;

    let badge = undefined;
    let badgeVariant: 'best' | 'warning' | 'neutral' | 'primary' | undefined = undefined;

    if (reg.id === 'cloudflare') {
      badge = `⭐ Best ${horizonYears}-Yr Value`;
      badgeVariant = 'best';
    } else if (reg.id === 'godaddy') {
      badge = `⚠️ +${reg.hikePercent}% Spike`;
      badgeVariant = 'warning';
    }

    const year1Percent = Math.max(8, Math.round((year1 / calculatedTotal) * 100));
    const renewalPercent = 100 - year1Percent;

    return {
      registrarId: reg.id,
      registrarName: reg.registrarName,
      icon: reg.icon,
      tagline:
        reg.id === 'cloudflare'
          ? 'At-cost registry wholesale pricing (0% markup)'
          : reg.id === 'porkbun'
          ? 'Transparent ICANN wholesale fees + minimal buffer'
          : reg.id === 'namecheap'
          ? 'Free lifetime privacy + standard renewal tiers'
          : 'Promotional intro year, high recurring thereafter',
      badge,
      badgeVariant,
      year1Cost: year1,
      renewalAnnualCost: reg.renewalPrice,
      calculatedTotalCost: calculatedTotal,
      calculatedTotalFormatted: `₹${calculatedTotal.toLocaleString('en-IN')}`,
      year1Formatted: `Yr-1: ${reg.registrationFormatted}`,
      year1Percent,
      renewalPercent,
      isBestValue: reg.id === 'cloudflare',
      isMarkupSpike: reg.id === 'godaddy',
    };
  });
}

export function calculateTransferSavings(
  currentRate: number,
  targetRate: number,
  count: number
): TransferCalculationResult {
  const currentAnnual = currentRate * count;
  const projectedAnnual = targetRate * count;
  const annualSavings = Math.max(0, currentAnnual - projectedAnnual);
  const threeYearSavings = annualSavings * 3;
  const percentSavings =
    currentAnnual > 0 ? Math.round((annualSavings / currentAnnual) * 100) : 0;

  return {
    currentAnnual,
    projectedAnnual,
    annualSavings,
    threeYearSavings,
    percentSavings,
    currentAnnualFormatted: `₹${currentAnnual.toLocaleString('en-IN')}`,
    projectedAnnualFormatted: `₹${projectedAnnual.toLocaleString('en-IN')}`,
    annualSavingsFormatted: `₹${annualSavings.toLocaleString('en-IN')}`,
    threeYearSavingsFormatted: `₹${threeYearSavings.toLocaleString('en-IN')}`,
  };
}
