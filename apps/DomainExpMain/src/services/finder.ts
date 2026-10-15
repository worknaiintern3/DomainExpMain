import { apiGet } from './api';
import type { DomainSearchResult } from '../types';

const TLD_PRICES: Record<string, number> = {
  '.in': 499,
  '.com': 899,
  '.org': 999,
  '.net': 1099,
  '.dev': 1199,
  '.app': 1199,
  '.tech': 799,
  '.co': 1899,
  '.io': 3200,
  '.ai': 5800,
};

const dnsMemoryCache = new Map<string, { result: { isRegistered: boolean; nameservers: string[] }; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fastDnsCheck(domain: string): Promise<{ isRegistered: boolean; nameservers: string[] }> {
  const cached = dnsMemoryCache.get(domain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  const fetchDns = async (url: string) => {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(1200),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  try {
    const googleDns = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`;
    const cfDns = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`;

    // Race both Google and Cloudflare DNS resolvers
    const settled = await Promise.allSettled([fetchDns(cfDns), fetchDns(googleDns)]);
    const data = settled.find((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && Boolean(r.value))?.value;

    if (!data) {
      return { isRegistered: false, nameservers: [] };
    }

    // Status 3 is NXDOMAIN (domain does NOT exist / is available)
    if (data.Status === 3) {
      const res = { isRegistered: false, nameservers: [] };
      dnsMemoryCache.set(domain, { result: res, timestamp: Date.now() });
      return res;
    }

    const hasAnswers = Array.isArray(data.Answer) && data.Answer.length > 0;
    const hasAuthority = Array.isArray(data.Authority) && data.Authority.length > 0;
    const nsList: string[] = [];
    if (Array.isArray(data.Answer)) {
      for (const a of data.Answer) {
        if (a.data) nsList.push(String(a.data).replace(/\.$/, '').toLowerCase());
      }
    }

    const res = { isRegistered: hasAnswers || hasAuthority, nameservers: nsList };
    dnsMemoryCache.set(domain, { result: res, timestamp: Date.now() });
    return res;
  } catch {
    return { isRegistered: false, nameservers: [] };
  }
}

export async function searchDomainAvailability(domainQuery: string): Promise<DomainSearchResult> {
  const cleanName = domainQuery.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  const ext = cleanName.includes('.') ? `.${cleanName.split('.').pop()}` : '.com';
  const defaultPrice = TLD_PRICES[ext] || 899;

  // 1. Query backend WhoisFreaks availability endpoint
  try {
    const base = cleanName.replace(/\.[a-z0-9.]+$/i, '');
    const backendRes = await apiGet<
      Array<{ domain: string; tld: string; available: boolean; nameservers: string[] }>
    >(`/whois/availability?query=${encodeURIComponent(base)}&tlds=${encodeURIComponent(ext)}`, {
      auth: false,
    });
    if (Array.isArray(backendRes) && backendRes.length > 0) {
      const match = backendRes[0];
      return {
        domain: match.domain,
        tld: ext,
        available: match.available,
        price: defaultPrice,
        currency: '₹',
        premium: match.available && base.length <= 3,
        whoisSummary: !match.available
          ? {
              registrar: match.nameservers.length > 0 ? `${match.nameservers[0].split('.')[1]?.toUpperCase() || 'Active'} DNS` : 'Registered Domain',
            }
          : undefined,
      };
    }
  } catch {}

  // 2. Direct WhoisFreaks Live Availability API fallback
  try {
    const wfKey = process.env.EXPO_PUBLIC_WHOISFREAKS_API_KEY || 'aa02fd191f444368a77d343ecf4c2994';
    const wfRes = await fetch(
      `https://api.whoisfreaks.com/v1.0/domain/availability?apiKey=${encodeURIComponent(wfKey)}&domain=${encodeURIComponent(cleanName)}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(2000) }
    );
    if (wfRes.ok) {
      const wfData = await wfRes.json();
      if (typeof wfData.domainAvailability === 'boolean') {
        const isAvailable = wfData.domainAvailability;
        return {
          domain: cleanName,
          tld: ext,
          available: isAvailable,
          price: defaultPrice,
          currency: '₹',
          premium: isAvailable && cleanName.split('.')[0].length <= 3,
          whoisSummary: !isAvailable ? { registrar: 'Registered Domain' } : undefined,
        };
      }
    }
  } catch {}

  // 3. Fast DNS check fallback
  try {
    const dns = await fastDnsCheck(cleanName);
    const isAvailable = !dns.isRegistered;

    return {
      domain: cleanName,
      tld: ext,
      available: isAvailable,
      price: defaultPrice,
      currency: '₹',
      premium: isAvailable && cleanName.split('.')[0].length <= 3,
      whoisSummary: !isAvailable
        ? {
            registrar: dns.nameservers.length > 0 ? `${dns.nameservers[0].split('.')[1]?.toUpperCase() || 'Active'} DNS` : 'Registered Domain',
          }
        : undefined,
    };
  } catch {
    return {
      domain: cleanName,
      tld: ext,
      available: true,
      price: defaultPrice,
      currency: '₹',
      premium: false,
    };
  }
}

export async function searchMultipleTlds(
  keyword: string,
  selectedTlds: string[],
  onPartialResult?: (result: DomainSearchResult) => void,
): Promise<DomainSearchResult[]> {
  const cleanKeyword = keyword.trim().toLowerCase().replace(/^https?:\/\//, '');
  const firstSegment = cleanKeyword.split('/')[0] ?? '';
  const base = firstSegment.replace(/\.[a-z0-9.]+$/i, '');
  if (!base) return [];

  // 1. Blazing-fast backend native UDP DNS (< 100ms)
  try {
    const tldParam = selectedTlds.join(',');
    const backendResults = await apiGet<
      Array<{ domain: string; tld: string; available: boolean; nameservers: string[] }>
    >(`/whois/availability?query=${encodeURIComponent(base)}&tlds=${encodeURIComponent(tldParam)}`, {
      auth: false,
    });

    if (Array.isArray(backendResults) && backendResults.length > 0) {
      const mapped: DomainSearchResult[] = backendResults.map((item) => {
        const ext = item.tld.startsWith('.') ? item.tld : `.${item.tld}`;
        const defaultPrice = TLD_PRICES[ext] || 899;
        const res: DomainSearchResult = {
          domain: item.domain,
          tld: ext,
          available: item.available,
          price: defaultPrice,
          currency: '₹',
          premium: item.available && base.length <= 3,
          whoisSummary: !item.available
            ? {
                registrar:
                  item.nameservers.length > 0
                    ? `${item.nameservers[0].split('.')[1]?.toUpperCase() || 'Active'} DNS`
                    : 'Registered Domain',
              }
            : undefined,
        };
        // Cache in memory for instant subsequent checks
        dnsMemoryCache.set(item.domain, {
          result: { isRegistered: !item.available, nameservers: item.nameservers },
          timestamp: Date.now(),
        });
        if (onPartialResult) onPartialResult(res);
        return res;
      });
      return mapped;
    }
  } catch {
    // Backend offline / network unreachable -> graceful fallback to client DoH checks
  }

  // 2. Client-side DNS check fallback with progressive reporting
  const promises = selectedTlds.map(async (tld) => {
    const fullDomain = `${base}${tld.startsWith('.') ? tld : `.${tld}`}`;
    const result = await searchDomainAvailability(fullDomain);
    if (onPartialResult) onPartialResult(result);
    return result;
  });

  return Promise.all(promises);
}
