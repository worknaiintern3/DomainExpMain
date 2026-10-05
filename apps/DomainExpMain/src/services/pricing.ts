import { apiGet } from './api';
import type { RegistrarPricing } from '../types';

export async function fetchPricingForTld(tld: string): Promise<RegistrarPricing[]> {
  const normalized = tld.startsWith('.') ? tld : `.${tld}`;
  try {
    const response = await apiGet<{ items?: RegistrarPricing[] } | RegistrarPricing[]>(
      `/pricing?tld=${encodeURIComponent(normalized)}`
    );
    const items = Array.isArray(response)
      ? response
      : Array.isArray(response?.items)
      ? response.items
      : [];
    if (items.length > 0) return items;
  } catch {}

  return [];
}
