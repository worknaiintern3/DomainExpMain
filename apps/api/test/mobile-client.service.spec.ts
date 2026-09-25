import { describe, expect, it } from 'vitest';

import { MobileClientService } from '../src/mobile-client/mobile-client.service';

describe('MobileClientService', () => {
  it('returns default bootstrap configuration when database tables are empty', async () => {
    const mockDbService = {
      database: {
        select: () => ({
          from: () => ({
            limit: async () => [],
            orderBy: () => Promise.resolve([]),
            where: () => Promise.resolve([]),
          }),
        }),
      },
    } as any;

    const service = new MobileClientService(mockDbService);
    const config = await service.getBootstrapConfig();

    expect(config).toBeDefined();
    expect(config.app.appName).toBe('DomainPulse');
    expect(config.app.primaryColor).toBe('#2563EB');
    expect(config.app.maintenanceMode).toBe(false);
    expect(config.features.domains).toBe(true);
    expect(config.features.servers).toBe(true);
    expect(config.navigation.length).toBeGreaterThan(0);
    expect(config.homeSections.length).toBeGreaterThan(0);
    expect(config.version.minimumVersion).toBe('1.0.0');
  });
});
