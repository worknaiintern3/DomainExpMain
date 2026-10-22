import { describe, expect, it } from 'vitest';

import {
  describeProviderReason,
  formatRegistrarConfiguration,
} from '@/features/pricing';

describe('describeProviderReason keeps machine codes out of the UI', () => {
  it('maps domain_unavailable to registered copy', () => {
    expect(describeProviderReason('domain_unavailable')).toBe(
      'This domain is already registered.',
    );
  });

  it('maps known extension codes to professional copy', () => {
    expect(describeProviderReason('extension_disallows_registration')).toBe(
      'This extension cannot be registered through this registrar.',
    );
    expect(describeProviderReason('extension_not_supported')).toBe(
      'This registrar does not support this extension.',
    );
    expect(describeProviderReason('extension_not_supported_via_api')).toBe(
      'This registrar does not support this extension.',
    );
  });

  it('matches known codes case-insensitively', () => {
    expect(describeProviderReason('Domain_Unavailable')).toBe(
      'This domain is already registered.',
    );
  });

  it('returns null for null or blank reasons', () => {
    expect(describeProviderReason(null)).toBeNull();
    expect(describeProviderReason('   ')).toBeNull();
  });

  it('falls back to a safe generic line for unknown code-like tokens', () => {
    expect(describeProviderReason('some_future_upstream_code')).toBe(
      'The registrar did not provide more detail.',
    );
  });

  it('passes human-readable upstream descriptions through trimmed', () => {
    expect(describeProviderReason('Domain not available for registration')).toBe(
      'Domain not available for registration',
    );
  });
});

describe('formatRegistrarConfiguration uses singular/plural correctly', () => {
  it('uses "isn\'t" for exactly one unconfigured registrar', () => {
    expect(formatRegistrarConfiguration(1, 3)).toBe("1 of 3 registrars isn't configured");
  });

  it('uses "aren\'t" for zero or multiple unconfigured registrars', () => {
    expect(formatRegistrarConfiguration(0, 3)).toBe("0 of 3 registrars aren't configured");
    expect(formatRegistrarConfiguration(2, 3)).toBe("2 of 3 registrars aren't configured");
    expect(formatRegistrarConfiguration(3, 3)).toBe("3 of 3 registrars aren't configured");
  });
});
