import {
  TldAvailabilityItem,
  SmartSuggestionItem,
  SynthesizerSuggestion,
  RegistrarPriceQuote,
  DomainInspectionDetails,
  WatchlistItem,
  FindDomainSummary,
} from './findDomain.types';

export const SUPPORTED_TLDS: string[] = [
  '.com',
  '.in',
  '.co.in',
  '.ai',
  '.io',
  '.co',
  '.dev',
  '.app',
  '.tech',
  '.net',
  '.org',
];

export const RECENT_SEARCH_KEYWORDS: string[] = [
  'worknai',
  'finpilot',
  'anywork',
  'goairclass',
  'flowbase',
];

export const INITIAL_WATCHLIST: WatchlistItem[] = [
  {
    id: 'w-1',
    domain: 'worknai.io',
    status: 'available',
    priceFormatted: '₹2,499/yr via Porkbun',
    registrarNote: 'Porkbun LLC',
  },
  {
    id: 'w-2',
    domain: 'worknai.dev',
    status: 'available',
    priceFormatted: '₹1,099/yr via Namecheap',
    registrarNote: 'Namecheap',
  },
  {
    id: 'w-3',
    domain: 'tryworknai.com',
    status: 'available',
    priceFormatted: '₹799/yr via GoDaddy',
    registrarNote: 'GoDaddy',
  },
];

export const WORKNAI_TLD_RESULTS: TldAvailabilityItem[] = [
  {
    id: 'tld-com',
    domain: 'worknai.com',
    tld: '.com',
    status: 'registered',
    statusLabel: 'Registered',
    bestRegistrar: 'GoDaddy LLC',
  },
  {
    id: 'tld-in',
    domain: 'worknai.in',
    tld: '.in',
    status: 'available',
    statusLabel: 'Available',
    firstYearPrice: 699,
    firstYearPriceFormatted: '₹699',
    renewalPrice: 999,
    renewalPriceFormatted: '₹999',
    renewalHikeFormatted: '(+42%)',
    renewalHikeIsWarning: false,
    bestRegistrar: 'Hostinger',
    bestRegistrarBadge: '(Lowest)',
    topPickTag: 'Top Pick',
  },
  {
    id: 'tld-coin',
    domain: 'worknai.co.in',
    tld: '.co.in',
    status: 'available',
    statusLabel: 'Available',
    firstYearPrice: 599,
    firstYearPriceFormatted: '₹599',
    renewalPrice: 899,
    renewalPriceFormatted: '₹899',
    renewalHikeFormatted: 'renewal',
    bestRegistrar: 'Namecheap',
    bestRegistrarBadge: '(Best Deal)',
  },
  {
    id: 'tld-ai',
    domain: 'worknai.ai',
    tld: '.ai',
    status: 'registered',
    statusLabel: 'Registered',
    bestRegistrar: 'Cloudflare, Inc.',
  },
  {
    id: 'tld-io',
    domain: 'worknai.io',
    tld: '.io',
    status: 'available',
    statusLabel: 'Available',
    firstYearPrice: 2499,
    firstYearPriceFormatted: '₹2,499',
    renewalPrice: 3199,
    renewalPriceFormatted: '₹3,199',
    bestRegistrar: 'Porkbun LLC',
    isSaved: true,
  },
  {
    id: 'tld-dev',
    domain: 'worknai.dev',
    tld: '.dev',
    status: 'available',
    statusLabel: 'Available',
    firstYearPrice: 1099,
    firstYearPriceFormatted: '₹1,099',
    renewalPrice: 1299,
    renewalPriceFormatted: '₹1,299',
    bestRegistrar: 'Namecheap',
    isSaved: true,
  },
  {
    id: 'tld-app',
    domain: 'worknai.app',
    tld: '.app',
    status: 'available',
    statusLabel: 'Available',
    firstYearPrice: 1149,
    firstYearPriceFormatted: '₹1,149',
    renewalPrice: 1499,
    renewalPriceFormatted: '₹1,499',
    bestRegistrar: 'Squarespace (Google)',
  },
  {
    id: 'tld-tech',
    domain: 'worknai.tech',
    tld: '.tech',
    status: 'available',
    statusLabel: 'Available',
    firstYearPrice: 299,
    firstYearPriceFormatted: '₹299',
    renewalPrice: 1899,
    renewalPriceFormatted: '₹1,899',
    renewalHikeFormatted: '⚠️ +535% hike',
    renewalHikeIsWarning: true,
    bestRegistrar: 'Hostinger',
  },
  {
    id: 'tld-net',
    domain: 'worknai.net',
    tld: '.net',
    status: 'registered',
    statusLabel: 'Registered',
    bestRegistrar: 'Namecheap',
  },
  {
    id: 'tld-org',
    domain: 'worknai.org',
    tld: '.org',
    status: 'registered',
    statusLabel: 'Registered',
    bestRegistrar: 'Porkbun LLC',
  },
  {
    id: 'tld-co',
    domain: 'worknai.co',
    tld: '.co',
    status: 'registered',
    statusLabel: 'Registered',
    bestRegistrar: 'GoDaddy LLC',
  },
];

export const WORKNAI_SUGGESTIONS: SmartSuggestionItem[] = [
  {
    id: 'sug-1',
    domain: 'getworknai.com',
    status: 'available',
    priceFormatted: '₹799/yr',
    registrarHint: 'GoDaddy / Namecheap',
  },
  {
    id: 'sug-2',
    domain: 'tryworknai.com',
    status: 'available',
    priceFormatted: '₹799/yr',
    registrarHint: 'Porkbun / Spaceship',
    isSaved: true,
  },
  {
    id: 'sug-3',
    domain: 'worknaihub.com',
    status: 'available',
    priceFormatted: '₹749/yr',
    registrarHint: 'Hostinger Lowest',
  },
  {
    id: 'sug-4',
    domain: 'worknaitech.com',
    status: 'available',
    priceFormatted: '₹299/yr',
    registrarHint: 'Promo First-Year',
  },
  {
    id: 'sug-5',
    domain: 'worknaicloud.com',
    status: 'available',
    priceFormatted: '₹899/yr',
    registrarHint: 'Namecheap',
  },
  {
    id: 'sug-6',
    domain: 'worknaix.com',
    status: 'available',
    priceFormatted: '₹799/yr',
    registrarHint: 'Dynadot Wholesale',
  },
];

export const SYNTHESIZER_TONES = [
  'Brandable',
  'Short & Punchy',
  'Modern Compound',
  'Tech-Focused',
];

export const SYNTHESIZER_PRESETS: Record<string, SynthesizerSuggestion[]> = {
  Brandable: [
    { id: 'syn-1', domain: 'autoai.in', priceFormatted: '₹699', tone: 'Brandable' },
    { id: 'syn-2', domain: 'pulsework.ai', priceFormatted: '₹5,999', tone: 'Brandable' },
    { id: 'syn-3', domain: 'flowwork.io', priceFormatted: '₹2,499', tone: 'Brandable' },
  ],
  'Short & Punchy': [
    { id: 'syn-4', domain: 'workn.co', priceFormatted: '₹1,299', tone: 'Short & Punchy' },
    { id: 'syn-5', domain: 'aiwork.io', priceFormatted: '₹2,499', tone: 'Short & Punchy' },
    { id: 'syn-6', domain: 'wkn.dev', priceFormatted: '₹899', tone: 'Short & Punchy' },
  ],
  'Modern Compound': [
    { id: 'syn-7', domain: 'nexawork.ai', priceFormatted: '₹5,299', tone: 'Modern Compound' },
    { id: 'syn-8', domain: 'taskagent.in', priceFormatted: '₹699', tone: 'Modern Compound' },
    { id: 'syn-9', domain: 'opsflow.io', priceFormatted: '₹2,499', tone: 'Modern Compound' },
  ],
  'Tech-Focused': [
    { id: 'syn-10', domain: 'worknstack.dev', priceFormatted: '₹1,099', tone: 'Tech-Focused' },
    { id: 'syn-11', domain: 'corepulse.tech', priceFormatted: '₹299', tone: 'Tech-Focused' },
    { id: 'syn-12', domain: 'worknengine.app', priceFormatted: '₹1,149', tone: 'Tech-Focused' },
  ],
};

export const MULTI_REGISTRAR_PRICING_DATA: Record<string, RegistrarPriceQuote[]> = {
  'worknai.in': [
    {
      id: 'reg-hostinger',
      registrarName: 'Hostinger',
      tag: 'Lowest Reg',
      tagColor: 'bg-emerald-100 text-emerald-800',
      featureNote: 'Free SSL + Cloudflare Protected DNS',
      firstYearPrice: 699,
      firstYearFormatted: '₹699',
      renewalFormatted: 'Ren: ₹999',
    },
    {
      id: 'reg-namecheap',
      registrarName: 'Namecheap',
      tag: 'Best Long-Term',
      tagColor: 'bg-blue-100 text-blue-800',
      featureNote: 'Free lifetime WHOIS privacy',
      firstYearPrice: 749,
      firstYearFormatted: '₹749',
      renewalFormatted: 'Ren: ₹899',
    },
    {
      id: 'reg-godaddy',
      registrarName: 'GoDaddy',
      featureNote: '+55% Renewal hike after year 1',
      firstYearPrice: 899,
      firstYearFormatted: '₹899',
      renewalFormatted: 'Ren: ₹1,399',
      renewalHikeNote: '+55% hike',
    },
    {
      id: 'reg-porkbun',
      registrarName: 'Porkbun',
      featureNote: 'Flat transparent pricing model',
      firstYearPrice: 829,
      firstYearFormatted: '₹829',
      renewalFormatted: 'Ren: ₹949',
    },
    {
      id: 'reg-cloudflare',
      registrarName: 'Cloudflare Registrar',
      tag: 'Wholesale',
      tagColor: 'bg-surface-container text-secondary',
      featureNote: 'At-cost wholesale zero-markup',
      firstYearPrice: 715,
      firstYearFormatted: '₹715',
      renewalFormatted: 'Ren: ₹715 flat',
    },
  ],
};

export function getRegistrarQuotesForDomain(domain: string): RegistrarPriceQuote[] {
  if (MULTI_REGISTRAR_PRICING_DATA[domain]) {
    return MULTI_REGISTRAR_PRICING_DATA[domain];
  }
  // Deterministic fallback for other domains
  const isIo = domain.endsWith('.io');
  const isDev = domain.endsWith('.dev');
  const isAi = domain.endsWith('.ai');
  const basePrice = isAi ? 5999 : isIo ? 2499 : isDev ? 1099 : 799;

  return [
    {
      id: 'reg-hostinger',
      registrarName: 'Hostinger',
      tag: 'Lowest Reg',
      tagColor: 'bg-emerald-100 text-emerald-800',
      featureNote: 'Free SSL + Cloudflare Protected DNS',
      firstYearPrice: basePrice - 100,
      firstYearFormatted: `₹${(basePrice - 100).toLocaleString()}`,
      renewalFormatted: `Ren: ₹${(basePrice + 200).toLocaleString()}`,
    },
    {
      id: 'reg-namecheap',
      registrarName: 'Namecheap',
      tag: 'Best Long-Term',
      tagColor: 'bg-blue-100 text-blue-800',
      featureNote: 'Free lifetime WHOIS privacy',
      firstYearPrice: basePrice - 50,
      firstYearFormatted: `₹${(basePrice - 50).toLocaleString()}`,
      renewalFormatted: `Ren: ₹${(basePrice + 100).toLocaleString()}`,
    },
    {
      id: 'reg-godaddy',
      registrarName: 'GoDaddy',
      featureNote: 'Standard first-year promotion',
      firstYearPrice: basePrice + 100,
      firstYearFormatted: `₹${(basePrice + 100).toLocaleString()}`,
      renewalFormatted: `Ren: ₹${(basePrice + 500).toLocaleString()}`,
      renewalHikeNote: '+35% hike',
    },
    {
      id: 'reg-porkbun',
      registrarName: 'Porkbun',
      featureNote: 'Flat transparent pricing model',
      firstYearPrice: basePrice + 30,
      firstYearFormatted: `₹${(basePrice + 30).toLocaleString()}`,
      renewalFormatted: `Ren: ₹${(basePrice + 50).toLocaleString()}`,
    },
    {
      id: 'reg-cloudflare',
      registrarName: 'Cloudflare Registrar',
      tag: 'Wholesale',
      tagColor: 'bg-surface-container text-secondary',
      featureNote: 'At-cost wholesale zero-markup',
      firstYearPrice: basePrice,
      firstYearFormatted: `₹${basePrice.toLocaleString()}`,
      renewalFormatted: `Ren: ₹${basePrice.toLocaleString()} flat`,
    },
  ];
}

export function getDomainInspectionDetails(
  domain: string,
  status?: 'available' | 'registered'
): DomainInspectionDetails {
  const isRegistered =
    status === 'registered' ||
    domain.endsWith('.com') ||
    domain.endsWith('.ai') ||
    domain.endsWith('.net') ||
    domain.endsWith('.org') ||
    domain.endsWith('.co');

  if (isRegistered) {
    return {
      domain,
      status: 'registered',
      statusBadgeText: 'Registered • Reference',
      sponsoringRegistrar: domain.endsWith('.ai')
        ? 'Cloudflare, Inc. (IANA #1910)'
        : domain.endsWith('.io') || domain.endsWith('.org')
        ? 'Porkbun LLC (IANA #1861)'
        : 'GoDaddy LLC (IANA #146)',
      registrationDateFormatted: '08 Sep 2022 14:22 UTC',
      expirationDateFormatted: '08 Sep 2026',
      expirationDaysRemaining: 3,
      lastUpdateFormatted: '12 Aug 2025',
      authoritativeNameservers: ['ns1.godaddy.com', 'ns2.godaddy.com'],
      dnssecValidation: 'Unsigned',
      dnssecStatus: 'unsigned',
      whoisPrivacy: 'Shielded (Domains By Proxy, LLC)',
      registryDomainId: '2682949184_DOMAIN_COM-VRSN',
      icannStatusFlags: [
        'clientDeleteProhibited',
        'clientRenewProhibited',
        'clientTransferProhibited',
      ],
      operationalNotice:
        'Reference expiry date is approaching. Post-expiry grace and redemption periods vary by registry and registrar. Verify the current lifecycle with the provider.',
    };
  }

  return {
    domain,
    status: 'available',
    statusBadgeText: 'Available • Reference',
    sponsoringRegistrar: 'Unallocated Root Registry',
    registrationDateFormatted: '— (Unregistered)',
    expirationDateFormatted: 'Available for immediate registration',
    lastUpdateFormatted: 'Root Zone Reference Record',
    authoritativeNameservers: ['None (Assign at registration)'],
    dnssecValidation: 'Available on Delegation',
    dnssecStatus: 'signed',
    whoisPrivacy: 'Supported by Preferred Registrars',
    icannStatusFlags: ['Available', 'Standard Tier'],
    operationalNotice:
      'Reference Preview: This domain is unallocated in the root TLD zone and eligible for standard registration.',
  };
}

export function searchDomains(
  query: string,
  selectedTlds: string[] = SUPPORTED_TLDS,
  savedSet: Set<string> = new Set()
): {
  items: TldAvailabilityItem[];
  summary: FindDomainSummary;
  suggestions: SmartSuggestionItem[];
} {
  const cleanKeyword = (query || 'worknai').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

  if (cleanKeyword === 'worknai' || cleanKeyword === '') {
    const items = WORKNAI_TLD_RESULTS.filter((item) =>
      selectedTlds.includes(item.tld)
    ).map((item) => ({
      ...item,
      isSaved: savedSet.has(item.domain) || item.isSaved,
    }));

    const availableCount = items.filter((i) => i.status === 'available').length;
    const registeredCount = items.filter((i) => i.status === 'registered').length;

    return {
      items,
      summary: {
        activeQuery: 'worknai',
        extensionsCheckedCount: items.length,
        availableCount,
        registeredCount,
        lowestRegPriceFormatted: '₹599/yr',
        lowestRegDetails: '(.co.in Namecheap)',
      },
      suggestions: WORKNAI_SUGGESTIONS.map((s) => ({
        ...s,
        isSaved: savedSet.has(s.domain) || s.isSaved,
      })),
    };
  }

  // Dynamic generator for any user query
  const items: TldAvailabilityItem[] = selectedTlds.map((tld, idx) => {
    const domain = `${cleanKeyword}${tld}`;
    const isRegistered = idx % 3 === 0; // Deterministic test pattern
    const isAvailable = !isRegistered;
    const basePrice = tld === '.ai' ? 5999 : tld === '.io' ? 2499 : tld === '.dev' ? 1099 : 699;

    return {
      id: `tld-${cleanKeyword}-${tld.replace('.', '')}`,
      domain,
      tld,
      status: isAvailable ? 'available' : 'registered',
      statusLabel: isAvailable ? 'Available' : 'Registered',
      firstYearPrice: isAvailable ? basePrice : undefined,
      firstYearPriceFormatted: isAvailable ? `₹${basePrice.toLocaleString()}` : undefined,
      renewalPrice: isAvailable ? basePrice + 300 : undefined,
      renewalPriceFormatted: isAvailable ? `₹${(basePrice + 300).toLocaleString()}` : undefined,
      renewalHikeFormatted: isAvailable ? `(+${Math.round((300 / basePrice) * 100)}%)` : undefined,
      bestRegistrar: isAvailable ? (idx % 2 === 0 ? 'Hostinger' : 'Namecheap') : 'GoDaddy LLC',
      bestRegistrarBadge: isAvailable && idx === 1 ? '(Lowest)' : undefined,
      topPickTag: isAvailable && tld === '.in' ? 'Top Pick' : undefined,
      isSaved: savedSet.has(domain),
    };
  });

  const availableCount = items.filter((i) => i.status === 'available').length;
  const registeredCount = items.filter((i) => i.status === 'registered').length;
  const availableItemsWithPrice = items.filter((i) => i.firstYearPrice);
  const lowestPriceItem =
    availableItemsWithPrice.length > 0
      ? availableItemsWithPrice.reduce((min, curr) =>
          (curr.firstYearPrice || 99999) < (min.firstYearPrice || 99999) ? curr : min
        )
      : null;

  const suggestions: SmartSuggestionItem[] = [
    {
      id: `sug-${cleanKeyword}-1`,
      domain: `get${cleanKeyword}.com`,
      status: 'available',
      priceFormatted: '₹799/yr',
      registrarHint: 'Namecheap / GoDaddy',
      isSaved: savedSet.has(`get${cleanKeyword}.com`),
    },
    {
      id: `sug-${cleanKeyword}-2`,
      domain: `try${cleanKeyword}.com`,
      status: 'available',
      priceFormatted: '₹799/yr',
      registrarHint: 'Porkbun / Spaceship',
      isSaved: savedSet.has(`try${cleanKeyword}.com`),
    },
    {
      id: `sug-${cleanKeyword}-3`,
      domain: `${cleanKeyword}hub.com`,
      status: 'available',
      priceFormatted: '₹749/yr',
      registrarHint: 'Hostinger Lowest',
      isSaved: savedSet.has(`${cleanKeyword}hub.com`),
    },
    {
      id: `sug-${cleanKeyword}-4`,
      domain: `${cleanKeyword}tech.com`,
      status: 'available',
      priceFormatted: '₹299/yr',
      registrarHint: 'Promo First-Year',
      isSaved: savedSet.has(`${cleanKeyword}tech.com`),
    },
    {
      id: `sug-${cleanKeyword}-5`,
      domain: `${cleanKeyword}cloud.com`,
      status: 'available',
      priceFormatted: '₹899/yr',
      registrarHint: 'Namecheap',
      isSaved: savedSet.has(`${cleanKeyword}cloud.com`),
    },
    {
      id: `sug-${cleanKeyword}-6`,
      domain: `${cleanKeyword}x.com`,
      status: 'available',
      priceFormatted: '₹799/yr',
      registrarHint: 'Dynadot Wholesale',
      isSaved: savedSet.has(`${cleanKeyword}x.com`),
    },
  ];

  return {
    items,
    summary: {
      activeQuery: cleanKeyword,
      extensionsCheckedCount: items.length,
      availableCount,
      registeredCount,
      lowestRegPriceFormatted: lowestPriceItem?.firstYearPriceFormatted || '₹599/yr',
      lowestRegDetails: lowestPriceItem
        ? `(${lowestPriceItem.tld} ${lowestPriceItem.bestRegistrar})`
        : '(.co.in Namecheap)',
    },
    suggestions,
  };
}
