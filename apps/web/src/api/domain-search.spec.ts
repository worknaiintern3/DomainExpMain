import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from './client';
import {
  formatMinorUnits,
  searchDomainAvailability,
} from './domain-search';

vi.mock('./client', () => ({ apiRequest: vi.fn() }));

const apiRequestMock = vi.mocked(apiRequest);

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockResolvedValue({ domain: 'example.com', results: [] });
});

describe('domain-search adapter', () => {
  it('queries the fixed search path with an encoded domain and signal', async () => {
    const controller = new AbortController();
    await searchDomainAvailability('Example.COM.', controller.signal);

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    const [path, options] = apiRequestMock.mock.calls[0] as [string, { signal?: AbortSignal }];
    expect(path).toBe('/domain-search?domain=Example.COM.');
    expect(options.signal).toBe(controller.signal);
  });

  it('encodes special characters in the domain query', async () => {
    await searchDomainAvailability('münchen.de');

    const [path] = apiRequestMock.mock.calls[0] as [string];
    expect(path).toBe('/domain-search?domain=m%C3%BCnchen.de');
  });

  it('formats minor units only when both amount and currency exist', () => {
    expect(formatMinorUnits(857, 'USD')).toBe('$8.57');
    expect(formatMinorUnits(1199, 'USD')).toBe('$11.99');
    expect(formatMinorUnits(null, 'USD')).toBeNull();
    expect(formatMinorUnits(857, null)).toBeNull();
    expect(formatMinorUnits(857, 'XX')).toBeNull();
  });

  it('formats with the currency exponent and without floating point', () => {
    // 0.29 * 100 style pitfalls: the decimal point is inserted by position.
    expect(formatMinorUnits(29, 'USD')).toBe('$0.29');
    expect(formatMinorUnits(5, 'USD')).toBe('$0.05');
    expect(formatMinorUnits(0, 'USD')).toBe('$0.00');
    expect(formatMinorUnits(110, 'USD')).toBe('$1.10');
    // Whole-unit and three-decimal currencies are not forced to two decimals.
    expect(formatMinorUnits(1500, 'JPY')).toBe('¥1,500');
    expect(formatMinorUnits(1199, 'TND')?.replace(/\u00a0/gu, ' ')).toBe('TND 1.199');
    // A large exact integer is not rounded through a float division.
    expect(formatMinorUnits(900_719_925_474_099, 'USD')).toBe('$9,007,199,254,740.99');
    // Different currencies stay in their own currency.
    expect(formatMinorUnits(999, 'EUR')).toBe('€9.99');
  });

  it('rejects unusable minor-unit values', () => {
    expect(formatMinorUnits(-1, 'USD')).toBeNull();
    expect(formatMinorUnits(11.99, 'USD')).toBeNull();
    expect(formatMinorUnits(Number.NaN, 'USD')).toBeNull();
    expect(formatMinorUnits(Number.MAX_SAFE_INTEGER + 2, 'USD')).toBeNull();
  });
});
