import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  MobileAppConfigSchema,
  MobileAppVersionSchema,
  MobileBootstrapConfigResponseSchema,
  MobileFeatureFlagSchema,
  MobileHomeSectionSchema,
  MobileNavigationItemSchema,
  UpdateMobileAppConfigRequestSchema,
} from '../src';

describe('mobile-config.schemas', () => {
  it('validates a complete bootstrap config successfully', () => {
    const validConfig = {
      app: {
        appName: 'DomainPulse',
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#2563EB',
        secondaryColor: '#1E293B',
        maintenanceMode: false,
        maintenanceMessage: null,
      },
      features: {
        domains: true,
        servers: true,
        websites: true,
      },
      featureFlags: [
        {
          key: 'domains',
          name: 'Domain Management',
          description: 'Manage domain portfolio',
          enabled: true,
          minAppVersion: '1.0.0',
        },
      ],
      navigation: [
        {
          key: 'home',
          label: 'Home',
          icon: 'home',
          route: '/home',
          sortOrder: 1,
          enabled: true,
          badge: null,
        },
      ],
      homeSections: [
        {
          sectionKey: 'stats',
          title: 'Portfolio Overview',
          sortOrder: 1,
          enabled: true,
          configJson: null,
        },
      ],
      version: {
        platform: 'all' as const,
        minimumVersion: '1.0.0',
        latestVersion: '1.1.0',
        forceUpdate: false,
        updateUrl: 'https://domainpulse.io/app',
        releaseNotes: 'Performance improvements',
      },
      announcements: [
        {
          id: randomUUID(),
          title: 'Welcome to Mobile',
          message: 'Monitor domains on the go!',
          type: 'info' as const,
          actionUrl: null,
          actionLabel: null,
          isActive: true,
          startsAt: null,
          expiresAt: null,
        },
      ],
    };

    const parsed = MobileBootstrapConfigResponseSchema.safeParse(validConfig);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid color formats in app config', () => {
    const invalidConfig = {
      appName: 'DomainPulse',
      primaryColor: 'invalid-color',
      secondaryColor: '#123',
      maintenanceMode: false,
    };
    const parsed = MobileAppConfigSchema.safeParse(invalidConfig);
    expect(parsed.success).toBe(false);
  });

  it('validates partial updates in admin mutation schema', () => {
    const update = {
      primaryColor: '#10B981',
      maintenanceMode: true,
    };
    const parsed = UpdateMobileAppConfigRequestSchema.safeParse(update);
    expect(parsed.success).toBe(true);
  });
});
