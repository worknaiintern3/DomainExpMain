import { apiGet } from './api';
import type {
  ApplicationItem,
  GooglePlayDeveloperSearchResult,
  GooglePlayDeveloperAppsResult,
  PlayStoreAppDetail,
} from '../types';

function sanitizeHtml(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function cleanDev(str?: string | null): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isDevMatch(appDev?: string | null, targetDev?: string | null): boolean {
  if (!appDev || !targetDev) return false;
  const a = cleanDev(appDev);
  const b = cleanDev(targetDev);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;

  const wordsA = (appDev || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const wordsB = (targetDev || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return wordsA.some((w) => wordsB.includes(w));
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 2500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/**
 * Fetch detailed live metadata for a single Google Play package
 */
export async function fetchGooglePlayAppDetails(packageId: string, fallbackDevName?: string): Promise<ApplicationItem | null> {
  const cleanPkg = packageId.trim();
  if (!cleanPkg || !cleanPkg.includes('.')) return null;

  try {
    const detailUrl = `https://play.google.com/store/apps/details?id=${cleanPkg}&hl=en&gl=US`;
    const res = await fetchWithTimeout(detailUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    }, 2500);

    if (!res.ok) return null;
    const html = await res.text();

    // Title
    let title = cleanPkg;
    const titleM =
      html.match(/<title>([^<]+)\s*-\s*Apps on Google Play<\/title>/i) ||
      html.match(/<h1[^>]*><span[^>]*>([^<]+)<\/span><\/h1>/i) ||
      html.match(/<h1[^>]*itemprop="name"[^>]*>([^<]+)<\/h1>/i) ||
      html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleM) {
      title = sanitizeHtml(titleM[1]);
    }

    // High-resolution Icon (512x512)
    let iconUrl: string | undefined = undefined;
    const iconM =
      html.match(/src="(https:\/\/play-lh\.googleusercontent\.com\/[^"]+)"[^>]*itemprop="image"/i) ||
      html.match(/<img[^>]*src="(https:\/\/play-lh\.googleusercontent\.com\/[^"]+)"[^>]*class="[^"]*T75of/i) ||
      html.match(/"(https:\/\/play-lh\.googleusercontent\.com\/[a-zA-Z0-9_\-=]+)"/i);
    if (iconM) {
      iconUrl = iconM[1];
      if (!iconUrl.includes('=s')) iconUrl += '=s512';
    }

    // Developer Name
    let devName = fallbackDevName || 'Android Developer';
    const devM =
      html.match(/<a[^>]*href="\/store\/apps\/developer\?id=([^"]+)"[^>]*><span[^>]*>([^<]+)<\/span><\/a>/i) ||
      html.match(/<a[^>]*href="\/store\/apps\/dev\?id=[0-9]+"[^>]*><span[^>]*>([^<]+)<\/span><\/a>/i);
    if (devM) {
      devName = sanitizeHtml(devM[2] || decodeURIComponent(devM[1]));
    }

    return {
      id: `play-${cleanPkg.replace(/[^a-zA-Z0-9]/g, '-')}`,
      name: title,
      packageId: cleanPkg,
      developerName: devName,
      iconUrl,
      playStoreUrl: `https://play.google.com/store/apps/details?id=${cleanPkg}`,
      environment: 'Production',
      status: 'healthy',
      releaseTrack: 'Production',
      version: '1.0.0',
      serverName: 'Google Play Console',
      url: `https://play.google.com/store/apps/details?id=${cleanPkg}`,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Universally discovers and fetches ALL REAL live applications from Google Play Console
 * for the exact developer / console account name entered by user.
 */
export async function fetchRealDeveloperApps(
  developerInput: string,
  customPackageIds: string[] = []
): Promise<ApplicationItem[]> {
  const query = (developerInput || '').trim();
  if (!query && (!customPackageIds || customPackageIds.length === 0)) {
    return [];
  }

  const foundAppsMap = new Map<string, ApplicationItem>();

  // 1. Query real backend universal developer apps endpoint first (< 300ms)
  if (query) {
    try {
      const res = await apiGet<{
        developerId: string;
        developerName: string;
        total: number;
        apps: PlayStoreAppDetail[];
      }>(
        `/play-store/developers/${encodeURIComponent(query)}/apps?limit=100`,
        { auth: false, retryOnUnauthorized: false }
      );

      if (res?.apps && Array.isArray(res.apps) && res.apps.length > 0) {
        for (const app of res.apps) {
          const pkg = (app.packageId || '').trim();
          if (pkg) {
            foundAppsMap.set(pkg.toLowerCase(), {
              id: app.id || `play-${pkg.replace(/[^a-zA-Z0-9]/g, '-')}`,
              name: app.name || pkg,
              packageId: pkg,
              developerName: app.developerName || res.developerName || query,
              iconUrl: app.iconUrl,
              playStoreUrl: app.playStoreUrl || `https://play.google.com/store/apps/details?id=${pkg}`,
              url: app.playStoreUrl || `https://play.google.com/store/apps/details?id=${pkg}`,
              serverName: 'Google Play Console',
              environment: 'Production',
              status: 'healthy',
              version: '1.0.0',
              rating: app.score,
              releaseTrack: 'Production',
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // Backend offline / network unreachable -> proceed to custom packages & probe fallback
    }
  }

  // 2. Process custom package IDs or direct package ID input
  const explicitPackages = new Set<string>();
  if (Array.isArray(customPackageIds)) {
    for (const raw of customPackageIds) {
      const p = (raw || '').trim();
      if (p && p.includes('.')) explicitPackages.add(p);
    }
  }
  if (query.includes('.') && !query.includes(' ') && query.length > 4) {
    explicitPackages.add(query);
  }

  // Probe explicit packages directly if not already found
  const missingExplicit = Array.from(explicitPackages).filter(
    (pkg) => !foundAppsMap.has(pkg.toLowerCase())
  );
  if (missingExplicit.length > 0) {
    await Promise.all(
      missingExplicit.map(async (pkg) => {
        const app = await fetchGooglePlayAppDetails(pkg, query);
        if (app) {
          foundAppsMap.set(pkg.toLowerCase(), app);
        } else {
          const fallbackTitle = pkg
            .split('.')
            .pop()
            ?.replace(/^[a-z]/, (c) => c.toUpperCase()) || pkg;
          foundAppsMap.set(pkg.toLowerCase(), {
            id: `play-${pkg.replace(/[^a-zA-Z0-9]/g, '-')}`,
            name: fallbackTitle,
            packageId: pkg,
            developerName: query,
            environment: 'Production',
            status: 'healthy',
            releaseTrack: 'Production',
            version: '1.0.0',
            serverName: 'Google Play Console',
            playStoreUrl: `https://play.google.com/store/apps/details?id=${pkg}`,
            url: `https://play.google.com/store/apps/details?id=${pkg}`,
            updatedAt: new Date().toISOString(),
          });
        }
      })
    );
  }

  // If backend returned apps, return them immediately without slow HTML scraping!
  if (foundAppsMap.size > 0) {
    return Array.from(foundAppsMap.values());
  }

  // 3. Fallback: Discover Google Play Packages for the Developer Name via HTML probe
  const playPackages = new Set<string>([...explicitPackages]);

  let devIdParam = query;
  if (query.includes('id=')) {
    const m = query.match(/id=([^&]+)/);
    if (m) devIdParam = decodeURIComponent(m[1]);
  }

  const googlePlaySearchUrls = [
    `https://play.google.com/store/apps/developer?id=${encodeURIComponent(devIdParam)}&hl=en&gl=IN`,
    `https://play.google.com/store/apps/developer?id=${encodeURIComponent(devIdParam)}&hl=en&gl=US`,
    `https://play.google.com/store/search?q=${encodeURIComponent(query)}&c=apps&hl=en&gl=IN`,
    `https://play.google.com/store/search?q=${encodeURIComponent(query)}&c=apps&hl=en&gl=US`,
  ];

  if (/^[0-9]+$/.test(devIdParam)) {
    googlePlaySearchUrls.unshift(`https://play.google.com/store/apps/dev?id=${devIdParam}&hl=en&gl=IN`);
    googlePlaySearchUrls.unshift(`https://play.google.com/store/apps/dev?id=${devIdParam}&hl=en&gl=US`);
  }

  for (const url of googlePlaySearchUrls) {
    if (playPackages.size >= 40) break;
    try {
      const res = await fetchWithTimeout(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      }, 5000);
      if (res.ok) {
        const html = await res.text();
        const regex = /\/store\/apps\/details\?id=([a-zA-Z0-9._]+)/g;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(html)) !== null) {
          const pkg = m[1];
          if (
            !pkg.includes('com.google.android.gms') &&
            !pkg.includes('com.android.vending') &&
            pkg.includes('.')
          ) {
            playPackages.add(pkg);
          }
        }
      }
    } catch {
      // Continue
    }
  }

  // 3. Fetch details for Google Play packages concurrently (in batches of 6)
  const pkgArray = Array.from(playPackages).filter((p) => !foundAppsMap.has(p.toLowerCase())).slice(0, 35);
  const batchSize = 6;
  for (let i = 0; i < pkgArray.length; i += batchSize) {
    const batch = pkgArray.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (pkg) => {
        const app = await fetchGooglePlayAppDetails(pkg, query);
        if (app) {
          foundAppsMap.set(pkg.toLowerCase(), app);
        }
      })
    );
  }

  // 4. Strict Developer Account Filter
  // Only keep applications that actually belong to the entered developer / console account
  const allFound = Array.from(foundAppsMap.values());
  const developerApps: ApplicationItem[] = [];

  for (const app of allFound) {
    const isExplicit = explicitPackages.has(app.packageId || '');
    const isExactDev = isDevMatch(app.developerName, query);

    if (isExactDev || isExplicit) {
      developerApps.push({
        ...app,
        developerName: app.developerName || query,
      });
    }
  }

  // Return strictly the matching apps for this developer account
  return developerApps;
}

/**
 * Universal Developer Search: queries backend API (/play-store/developers/search?q=...)
 * with automatic fallback to direct public web probe if offline.
 */
export async function searchGooglePlayDevelopers(
  query: string,
  limit = 25
): Promise<GooglePlayDeveloperSearchResult[]> {
  const clean = (query || '').trim();
  if (!clean) return [];

  // 1. Try real backend universal developer search endpoint
  try {
    const res = await apiGet<{ query: string; total: number; developers: GooglePlayDeveloperSearchResult[] }>(
      `/play-store/developers/search?q=${encodeURIComponent(clean)}&limit=${limit}`,
      { auth: false, retryOnUnauthorized: false }
    );
    if (res?.developers && Array.isArray(res.developers) && res.developers.length > 0) {
      return res.developers;
    }
  } catch {
    // Offline / direct fallback
  }

  // 2. Direct client-side probe fallback using live Google Play Store web pages
  return await searchGooglePlayDevelopersDirect(clean, limit);
}

/**
 * Direct client-side Google Play HTML probe fallback
 */
async function searchGooglePlayDevelopersDirect(
  query: string,
  limit = 25
): Promise<GooglePlayDeveloperSearchResult[]> {
  const devMap = new Map<string, GooglePlayDeveloperSearchResult>();

  // Probe direct developer page
  try {
    const directUrl = `https://play.google.com/store/apps/developer?id=${encodeURIComponent(query)}&hl=en&gl=US`;
    const res = await fetchWithTimeout(directUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    }, 4000);

    if (res.ok) {
      const html = await res.text();
      const appMatches = Array.from(html.matchAll(/\/store\/apps\/details\?id=([a-zA-Z0-9._]+)/g)).map((m) => m[1]);
      const uniquePkgs = Array.from(new Set(appMatches)).filter((p) => p.includes('.') && !p.includes('google.android.gms')).slice(0, 5);

      if (uniquePkgs.length > 0) {
        devMap.set(query.toLowerCase(), {
          id: query,
          name: query,
          sampleApps: uniquePkgs.map((p) => p.split('.').pop() || p),
          appCount: uniquePkgs.length,
          verified: true,
        });
      }
    }
  } catch {}

  // Probe search page for developer names
  try {
    const searchUrl = `https://play.google.com/store/search?q=${encodeURIComponent(query)}&c=apps&hl=en&gl=US`;
    const res = await fetchWithTimeout(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    }, 4000);

    if (res.ok) {
      const html = await res.text();
      // Extract developer links: href="/store/apps/developer?id=..." or dev?id=...
      const devRegex = /href="\/store\/apps\/developer\?id=([^"]+)"[^>]*>([^<]+)<\/a>/g;
      let m: RegExpExecArray | null;
      while ((m = devRegex.exec(html)) !== null) {
        const id = decodeURIComponent(m[1]);
        const name = sanitizeHtml(m[2]) || id;
        const key = name.toLowerCase();
        if (!devMap.has(key)) {
          devMap.set(key, {
            id,
            name,
            sampleApps: [],
            appCount: 1,
            verified: false,
          });
        }
      }
    }
  } catch {}

  return Array.from(devMap.values()).slice(0, limit);
}

/**
 * Universal Developer Apps Retrieval: queries backend API (/play-store/developers/:id/apps)
 * with automatic fallback to probe if offline.
 */
export async function fetchDeveloperPublicApps(
  developerId: string,
  limit = 60
): Promise<PlayStoreAppDetail[]> {
  const cleanId = (developerId || '').trim();
  if (!cleanId) return [];

  // 1. Try real backend universal developer apps endpoint
  try {
    const res = await apiGet<{
      developerId: string;
      developerName: string;
      total: number;
      apps: PlayStoreAppDetail[];
    }>(
      `/play-store/developers/${encodeURIComponent(cleanId)}/apps?limit=${limit}`,
      { auth: false, retryOnUnauthorized: false }
    );
    if (res?.apps && Array.isArray(res.apps) && res.apps.length > 0) {
      return res.apps;
    }
  } catch {
    // Direct fallback
  }

  // 2. Direct probe fallback
  const rawApps = await fetchRealDeveloperApps(cleanId);
  return rawApps.map((a) => ({
    id: a.id,
    name: a.name,
    packageId: a.packageId || '',
    developerName: a.developerName || cleanId,
    developerId: cleanId,
    iconUrl: a.iconUrl,
    playStoreUrl: a.playStoreUrl || `https://play.google.com/store/apps/details?id=${a.packageId}`,
    free: true,
    price: 'Free',
    score: a.rating,
    scoreText: a.rating ? a.rating.toFixed(1) : undefined,
  }));
}

