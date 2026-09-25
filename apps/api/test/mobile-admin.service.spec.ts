import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { MobileAdminService } from '../src/mobile-admin/mobile-admin.service';

describe('MobileAdminService', () => {
  it('updates app config and writes audit log', async () => {
    const configId = randomUUID();
    const existingConfig = {
      id: configId,
      appName: 'DomainPulse',
      logoUrl: null,
      primaryColor: '#2563EB',
      secondaryColor: '#1E293B',
      maintenanceMode: false,
      maintenanceMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const auditInsertSpy = vi.fn().mockResolvedValue([]);
    const updateSpy = vi.fn().mockReturnValue({
      set: () => ({
        where: () => ({
          returning: async () => [
            {
              ...existingConfig,
              appName: 'DomainPulse Pro',
              maintenanceMode: true,
            },
          ],
        }),
      }),
    });

    const mockDbService = {
      database: {
        select: () => ({
          from: () => ({
            limit: async () => [existingConfig],
          }),
        }),
        update: updateSpy,
        insert: () => ({
          values: auditInsertSpy,
        }),
      },
    } as any;

    const service = new MobileAdminService(mockDbService);
    const updated = await service.updateAppConfig(
      { appName: 'DomainPulse Pro', maintenanceMode: true },
      randomUUID(),
      '127.0.0.1',
    );

    expect(updated.appName).toBe('DomainPulse Pro');
    expect(updated.maintenanceMode).toBe(true);
    expect(auditInsertSpy).toHaveBeenCalled();
  });

  it('updates feature flags and logs audit', async () => {
    const auditInsertSpy = vi.fn().mockResolvedValue([]);
    const updateSpy = vi.fn().mockReturnValue({
      set: () => ({
        where: () => ({
          returning: async () => [
            {
              id: randomUUID(),
              key: 'domains',
              name: 'Domains',
              description: null,
              enabled: false,
              minAppVersion: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        }),
      }),
    });

    const mockDbService = {
      database: {
        select: () => ({
          from: async () => [{ key: 'domains', name: 'Domains', enabled: true }],
        }),
        update: updateSpy,
        insert: () => ({
          values: auditInsertSpy,
        }),
      },
    } as any;

    const service = new MobileAdminService(mockDbService);
    const updated = await service.updateFeatureFlag(
      'domains',
      { enabled: false },
      randomUUID(),
      '127.0.0.1',
    );

    expect(updated.enabled).toBe(false);
    expect(auditInsertSpy).toHaveBeenCalled();
  });
});
