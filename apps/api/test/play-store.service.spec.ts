import { describe, expect, it } from 'vitest';
import { PlayStoreService } from '../src/play-store/play-store.service';

describe('PlayStoreService (Universal Developer Search)', () => {
  const service = new PlayStoreService();

  it('searches for developer "Student Factory" and retrieves matching developer account', async () => {
    const res = await service.searchDevelopers('Student Factory');
    expect(res).toBeDefined();
    expect(res.query).toBe('Student Factory');
    expect(res.total).toBeGreaterThan(0);
    expect(res.developers.length).toBeGreaterThan(0);

    const topDev = res.developers[0];
    expect(topDev).toBeDefined();
    expect(topDev!.name.toLowerCase()).toContain('student factory');
    expect(topDev!.sampleApps.length).toBeGreaterThan(0);
  }, 20000);

  it('fetches apps for developer "Student Factory" with accurate package IDs', async () => {
    const res = await service.getDeveloperApps('Student Factory');
    expect(res).toBeDefined();
    expect(res.developerId).toBe('Student Factory');
    expect(res.total).toBeGreaterThan(0);
    expect(res.apps.length).toBeGreaterThan(0);

    // Verify apps published by Student Factory
    const packages = res.apps.map((a) => a.packageId);

    // At least one known Student Factory package must be present
    expect(
      packages.some(
        (pkg) =>
          pkg.includes('studentfactory') ||
          pkg === 'com.chandan.bmi' ||
          pkg.includes('bmi'),
      ),
    ).toBe(true);

    for (const app of res.apps) {
      expect(app.packageId).toBeDefined();
      expect(app.packageId).toContain('.');
      expect(app.playStoreUrl).toContain('play.google.com/store/apps/details?id=');
      expect(app.name).toBeTruthy();
    }
  }, 20000);

  it('searches for developer "Google LLC" and retrieves Google developer account', async () => {
    const res = await service.searchDevelopers('Google LLC');
    expect(res).toBeDefined();
    expect(res.total).toBeGreaterThan(0);
    expect(res.developers.length).toBeGreaterThan(0);
    expect(res.developers[0]!.name.toLowerCase()).toContain('google');
  }, 20000);

  it('fetches apps for developer "Google LLC" and does not mix with other developers', async () => {
    const res = await service.getDeveloperApps('Google LLC', 10);
    expect(res).toBeDefined();
    expect(res.total).toBeGreaterThan(0);

    for (const app of res.apps) {
      expect(app.developerName.toLowerCase()).toContain('google');
      expect(app.packageId.toLowerCase()).not.toContain('studentfactory');
    }
  }, 20000);

  it('searches and fetches apps for "Microsoft Corporation"', async () => {
    const devSearch = await service.searchDevelopers('Microsoft Corporation');
    expect(devSearch.total).toBeGreaterThan(0);
    const topDev = devSearch.developers[0];
    expect(topDev).toBeDefined();
    expect(topDev!.name.toLowerCase()).toContain('microsoft');

    const devApps = await service.getDeveloperApps(topDev!.id || 'Microsoft Corporation', 10);
    expect(devApps.total).toBeGreaterThan(0);
    expect(devApps.apps.length).toBeGreaterThan(0);
    expect(devApps.apps.some((a) => a.packageId.includes('microsoft'))).toBe(true);
    for (const app of devApps.apps) {
      expect(app.playStoreUrl).toContain('play.google.com/store/apps/details?id=' + app.packageId);
    }
  }, 25000);

  it('searches and fetches apps for "Adobe"', async () => {
    const devSearch = await service.searchDevelopers('Adobe');
    expect(devSearch.total).toBeGreaterThan(0);
    const topDev = devSearch.developers[0];
    expect(topDev).toBeDefined();
    expect(topDev!.name.toLowerCase()).toContain('adobe');

    const devApps = await service.getDeveloperApps(topDev!.id || 'Adobe', 10);
    expect(devApps.total).toBeGreaterThan(0);
    expect(devApps.apps.length).toBeGreaterThan(0);
    expect(devApps.apps.some((a) => a.packageId.includes('adobe'))).toBe(true);
  }, 25000);

  it('handles non-existent developer search cleanly without throwing error', async () => {
    const devSearch = await service.searchDevelopers('ZzXyNonExistentDev9876543210');
    expect(devSearch).toBeDefined();
    expect(devSearch.total).toBe(0);
    expect(devSearch.developers).toEqual([]);
  }, 20000);

  it('handles empty or whitespace queries gracefully', async () => {
    const res = await service.searchDevelopers('   ');
    expect(res.total).toBe(0);
    expect(res.developers).toEqual([]);
  });
});

