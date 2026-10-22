import { afterEach, describe, expect, it } from 'vitest';

import { configureExpiryThresholds, expiryTier } from '@/lib/expiry';

describe('expiry tiers from Portfolio settings', () => {
  afterEach(() => configureExpiryThresholds({ criticalDays: 7, warningDays: 30 }));

  it('uses 7 / 30 days by default (unchanged behaviour)', () => {
    expect(expiryTier(-3)).toBe('critical');
    expect(expiryTier(7)).toBe('critical');
    expect(expiryTier(8)).toBe('warning');
    expect(expiryTier(30)).toBe('warning');
    expect(expiryTier(31)).toBe('healthy');
  });

  it('follows the configured horizons', () => {
    configureExpiryThresholds({ criticalDays: 14, warningDays: 90 });
    expect(expiryTier(14)).toBe('critical');
    expect(expiryTier(15)).toBe('warning');
    expect(expiryTier(90)).toBe('warning');
    expect(expiryTier(91)).toBe('healthy');
  });
});
