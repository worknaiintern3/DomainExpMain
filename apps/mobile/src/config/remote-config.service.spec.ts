import { describe, expect, it } from 'vitest';
import { DEFAULT_MOBILE_CONFIG } from './default-config';
import { remoteConfigService } from './remote-config.service';

describe('remoteConfigService', () => {
  it('provides safe default fallback configuration', () => {
    const config = remoteConfigService.getConfig();
    expect(config).toBeDefined();
    expect(config.app.appName).toBe('DomainPulse');
    expect(config.features.domains).toBe(true);
    expect(config.features.servers).toBe(true);
    expect(config.navigation.length).toBeGreaterThan(0);
    expect(config.homeSections.length).toBeGreaterThan(0);
  });

  it('correctly checks whether a feature is enabled', () => {
    expect(remoteConfigService.isFeatureEnabled('domains')).toBe(true);
    expect(remoteConfigService.isFeatureEnabled('non_existent_feature')).toBe(false);
  });

  it('contains valid default theme colors', () => {
    expect(DEFAULT_MOBILE_CONFIG.app.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(DEFAULT_MOBILE_CONFIG.app.secondaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
