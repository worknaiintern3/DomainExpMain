import { createInventory, listAllInventory } from '@/api/inventory';
import type { GooglePlayApp } from '@/api/google-play';

export interface GooglePlaySyncResult {
  created: number;
  failed: number;
  skipped: number;
}

function packageFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).searchParams.get('id')?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** Add published Play apps to the same workspace inventory used by mobile. */
export async function syncGooglePlayApps(apps: readonly GooglePlayApp[]): Promise<GooglePlaySyncResult> {
  const existing = await listAllInventory('applications');
  const packages = new Set(existing.flatMap((item) => {
    const fromUrl = packageFromUrl(item.primaryUrl);
    return fromUrl ? [fromUrl] : [];
  }));
  const result: GooglePlaySyncResult = { created: 0, failed: 0, skipped: 0 };

  for (const app of apps) {
    const packageName = app.packageName.trim();
    if (!packageName) {
      result.failed += 1;
      continue;
    }
    const key = packageName.toLowerCase();
    if (packages.has(key)) {
      result.skipped += 1;
      continue;
    }
    try {
      await createInventory('applications', {
        kind: 'MOBILE_APPLICATION',
        name: app.appName || packageName,
        notes: packageName,
        primaryUrl: app.playStoreUrl || `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}`,
      });
      packages.add(key);
      result.created += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}
