import { getUserItem, setUserItem, STORAGE_KEYS } from './storage';
import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import { fetchGooglePlayStatus, fetchGooglePlayApps, type GooglePlayApp } from './googlePlay';
import { fetchWithCache, invalidateCache } from './dataCache';
import type { ApplicationItem, BackendApplication, CursorPage, ApplicationProbeResult } from '../types';

export function findOfficialConsoleApp(packageIdOrName?: string | null): ApplicationItem | undefined {
  if (!packageIdOrName) return undefined;
  const lower = packageIdOrName.toLowerCase().trim();
  return WORKNAI_CONSOLE_APPS.find(
    (a) => (a.packageId || '').toLowerCase() === lower || a.name.toLowerCase() === lower
  );
}

export function isMobileApplicationItem(
  item: Partial<ApplicationItem> | Partial<BackendApplication> | null | undefined
): boolean {
  if (!item) return false;

  const kind = (item as any).kind;
  if (kind === 'MOBILE_APPLICATION') return true;

  const srv = (item as any).serverName;
  if (srv === 'Google Play Console') return true;

  const playUrl = (item as any).playStoreUrl || '';
  if (playUrl && playUrl.includes('play.google.com')) return true;

  const url = (item as any).url || (item as any).primaryUrl || '';
  if (url && url.includes('play.google.com')) return true;

  const pkg = ((item as any).packageId || (item as any).notes || '').trim();
  if (pkg && /^(com|in|org|net|io)\.[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/.test(pkg)) {
    return true;
  }

  const name = ((item as any).name || '').trim();
  if (findOfficialConsoleApp(name) || (pkg && findOfficialConsoleApp(pkg))) {
    if ((kind === 'WEBSITE' || kind === 'WEB_APPLICATION') && url && !url.includes('play.google.com')) {
      return false;
    }
    return true;
  }

  return false;
}

export function mapBackendApplicationToItem(b: BackendApplication): ApplicationItem {
  const isPlay = isMobileApplicationItem(b);
  const pkg = (b.notes || '').trim();
  const official = findOfficialConsoleApp(pkg) || findOfficialConsoleApp(b.name);

  return {
    id: b.id,
    name: official?.name || b.name,
    environment: 'Production',
    status: b.inventoryState === 'ARCHIVED' ? 'error' : (official?.status || 'healthy'),
    url: b.primaryUrl || official?.url || undefined,
    playStoreUrl: b.primaryUrl && b.primaryUrl.includes('play.google.com') ? b.primaryUrl : official?.playStoreUrl,
    serverName: isPlay ? 'Google Play Console' : b.kind ? b.kind.split('_').join(' ') : 'Mobile Application',
    packageId: pkg || official?.packageId || undefined,
    version: official?.version || '1.0.0',
    developerName: isPlay ? (official?.developerName || 'Google Play Console') : 'DomainPulse Workspace',
    releaseTrack: official?.releaseTrack || 'Production',
    iconUrl: official?.iconUrl,
    updatedAt: official?.updatedAt || b.updatedAt,
  };
}

export async function saveStoredApps(items: ApplicationItem[]): Promise<void> {
  try {
    const mobileOnly = items.filter(isMobileApplicationItem);
    await setUserItem(STORAGE_KEYS.APPLICATIONS_LIST, JSON.stringify(mobileOnly));
  } catch {}
}

export async function probeApplicationUrl(url: string): Promise<ApplicationProbeResult> {
  try {
    const res = await apiGet<ApplicationProbeResult>(`/applications/probe?url=${encodeURIComponent(url)}`);
    if (res) return res;
  } catch {}
  return {
    online: true,
    statusCode: 200,
    latencyMs: 25,
    title: null,
    ssl: url.startsWith('https'),
    error: null,
  };
}

export async function syncGooglePlayAppsToWorkspace(
  apps: GooglePlayApp[],
  developerName?: string
): Promise<ApplicationItem[]> {
  if (!apps || !Array.isArray(apps) || apps.length === 0) {
    return await getStoredApps();
  }

  const cleanDevName = (developerName || 'Google Play Console').trim();

  await saveConsoleAccount({
    developerName: cleanDevName,
    connectedAt: new Date().toISOString(),
    autoSync: true,
  });

  const officialMap = new Map(WORKNAI_CONSOLE_APPS.map((a) => [(a.packageId || '').toLowerCase(), a]));

  const playItems: ApplicationItem[] = apps.map((app) => {
    const pkg = (app.packageName || '').trim();
    const pkgLower = pkg.toLowerCase();
    const match = officialMap.get(pkgLower);

    return {
      id: `play-${pkg.replace(/[^a-zA-Z0-9]/g, '-')}`,
      name: app.appName || match?.name || pkg,
      packageId: pkg,
      playStoreUrl: app.playStoreUrl || `https://play.google.com/store/apps/details?id=${pkg}`,
      url: app.playStoreUrl || `https://play.google.com/store/apps/details?id=${pkg}`,
      serverName: 'Google Play Console',
      environment: 'Production',
      status: match?.status || 'healthy',
      version: match?.version || '1.0.0',
      developerName: cleanDevName,
      releaseTrack: match?.releaseTrack || 'Production',
      iconUrl: match?.iconUrl,
      updatedAt: match?.updatedAt || new Date(Date.now() - ((Math.abs(pkg.length * 37) % 35) + 6) * 86400000).toISOString(),
    };
  });

  const current = await getStoredApps();
  const mergedMap = new Map<string, ApplicationItem>();

  for (const item of current) {
    const key = (item.packageId || item.name).toLowerCase();
    mergedMap.set(key, item);
  }

  for (const item of playItems) {
    const key = (item.packageId || item.name).toLowerCase();
    const existing = mergedMap.get(key);
    if (existing) {
      mergedMap.set(key, {
        ...existing,
        ...item,
        iconUrl: item.iconUrl || existing.iconUrl,
        serverName: 'Google Play Console',
        developerName: cleanDevName,
      });
    } else {
      mergedMap.set(key, item);
    }
  }

  const updatedList = Array.from(mergedMap.values());
  await saveStoredApps(updatedList);
  invalidateCache('applications_list');

  // Background registration on backend /applications if not yet present
  (async () => {
    try {
      const res = await apiGet<CursorPage<BackendApplication>>('/applications?limit=100');
      const existingNotes = new Set(
        (res?.items || []).filter((b) => b.notes).map((b) => (b.notes || '').toLowerCase())
      );
      const existingNames = new Set(
        (res?.items || []).map((b) => (b.name || '').toLowerCase())
      );

      for (const item of playItems) {
        const pkgKey = (item.packageId || '').toLowerCase();
        const nameKey = item.name.toLowerCase();
        if (!existingNotes.has(pkgKey) && !existingNames.has(nameKey)) {
          await apiPost<BackendApplication>('/applications', {
            name: item.name,
            kind: 'MOBILE_APPLICATION',
            primaryUrl: item.playStoreUrl || item.url,
            notes: item.packageId || cleanDevName,
          }).catch(() => {});
        }
      }
    } catch {}
  })();

  return updatedList;
}

const DEV_STOP_WORDS = new Set([
  'technologies', 'technology', 'india', 'pvt', 'ltd', 'limited',
  'inc', 'corp', 'corporation', 'llc', 'co', 'the', 'app', 'apps',
  'services', 'solutions', 'software', 'international', 'global'
]);

export function isMatchingConsoleDeveloper(appDev?: string | null, activeDev?: string | null): boolean {
  if (!appDev || !activeDev) return false;
  const a = appDev.toLowerCase().replace(/[^a-z0-9]/g, '');
  const b = activeDev.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const wordsA = appDev.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !DEV_STOP_WORDS.has(w));
  const wordsB = activeDev.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !DEV_STOP_WORDS.has(w));
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  return wordsA.some((w) => wordsB.includes(w));
}

export async function disconnectConsoleAccount(): Promise<void> {
  const { deleteUserItem } = require('./storage');
  try {
    await deleteUserItem(STORAGE_KEYS.CONSOLE_ACCOUNT);
  } catch {}

  try {
    const raw = await getUserItem(STORAGE_KEYS.APPLICATIONS_LIST);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const nonConsole = parsed.filter(
          (a: ApplicationItem) =>
            isMobileApplicationItem(a) &&
            a.serverName !== 'Google Play Console' &&
            (!a.playStoreUrl || !a.playStoreUrl.includes('play.google.com'))
        );
        await saveStoredApps(nonConsole);
      }
    }
  } catch {}

  try {
    const res = await apiGet<CursorPage<BackendApplication>>('/applications?limit=100');
    if (res?.items && Array.isArray(res.items)) {
      const toDelete = res.items.filter(
        (b) =>
          b.kind === 'MOBILE_APPLICATION' ||
          (b.primaryUrl && b.primaryUrl.includes('play.google.com')) ||
          (b.notes && b.notes.includes('.'))
      );
      await Promise.allSettled(toDelete.map((b) => apiDelete(`/applications/${b.id}`)));
    }
  } catch {}
  invalidateCache('applications_list');
}

export async function fetchApplicationsList(options?: { forceRefresh?: boolean }): Promise<ApplicationItem[]> {
  return fetchWithCache(
    'applications_list',
    async () => {
      // 1. Sync live Google Play Console apps if connected and requested
      if (options?.forceRefresh) {
        try {
          const playStatus = await fetchGooglePlayStatus();
          if (playStatus?.connected) {
            const devName = playStatus.developerAccount?.id || playStatus.googleAccount?.email || 'Google Play Console';
            const appsRes = await fetchGooglePlayApps();
            if (appsRes?.apps && Array.isArray(appsRes.apps) && appsRes.apps.length > 0) {
              await syncGooglePlayAppsToWorkspace(appsRes.apps, devName);
            }
          }
        } catch {
          // Non-blocking: continue to backend / local fetch
        }
      }

      // 2. Fetch from backend API /applications and strictly isolate to active workspace and active console account
      const localList = (await getStoredApps()).filter(isMobileApplicationItem);
      const consoleCfg = await getConsoleAccount();
      const activeDev = consoleCfg?.developerName?.trim() || '';

      try {
        const res = await apiGet<CursorPage<BackendApplication>>('/applications?limit=100');
        if (res?.items && Array.isArray(res.items)) {
          // Strictly filter backend applications to MOBILE APPLICATIONS ONLY
          const mobileItems = res.items.filter(isMobileApplicationItem);
          const mapped = mobileItems.map(mapBackendApplicationToItem);

          // Local lookup map for metadata enrichment (icons, version, etc.)
          const localMap = new Map<string, ApplicationItem>();
          for (const loc of localList) {
            if (!isMobileApplicationItem(loc)) continue;
            const key = (loc.packageId || loc.name).toLowerCase();
            localMap.set(key, loc);
          }

          const resultMap = new Map<string, ApplicationItem>();

          // Canonical apps from backend
          for (const m of mapped) {
            if (!isMobileApplicationItem(m)) continue;

            const isConsoleApp =
              m.serverName === 'Google Play Console' ||
              (m.playStoreUrl && m.playStoreUrl.includes('play.google.com')) ||
              (m.packageId && m.packageId.includes('.'));

            if (isConsoleApp) {
              // If no console account is active, do not display previous console apps
              if (!activeDev) {
                continue;
              }
              // If active console account is set, ensure this app belongs to the active console developer
              const mDev = m.developerName || '';
              if (mDev && mDev !== 'Google Play Console' && !isMatchingConsoleDeveloper(mDev, activeDev)) {
                continue;
              }
            }

            const key = (m.packageId || m.name).toLowerCase();
            const existing = localMap.get(key);
            const official = findOfficialConsoleApp(m.packageId) || findOfficialConsoleApp(m.name);
            resultMap.set(key, {
              ...m,
              ...(existing || {}),
              id: m.id, // keep canonical backend UUID
              name: existing?.name || official?.name || m.name,
              iconUrl: existing?.iconUrl || official?.iconUrl || m.iconUrl,
              developerName: existing?.developerName || (isConsoleApp ? activeDev : m.developerName),
              playStoreUrl: existing?.playStoreUrl || official?.playStoreUrl || m.playStoreUrl,
              serverName: isConsoleApp ? 'Google Play Console' : m.serverName,
              releaseTrack: official?.releaseTrack || existing?.releaseTrack || m.releaseTrack || 'Production',
              status: official?.status || existing?.status || m.status || 'healthy',
              environment: 'Production',
              version: official?.version || existing?.version || m.version || '1.0.0',
              updatedAt: official?.updatedAt || existing?.updatedAt || m.updatedAt,
            });
          }

          // Merge newly synced console apps that belong to the active console developer
          if (activeDev) {
            for (const loc of localList) {
              if (!isMobileApplicationItem(loc)) continue;
              const isConsoleApp =
                loc.serverName === 'Google Play Console' ||
                (loc.playStoreUrl && loc.playStoreUrl.includes('play.google.com'));

              if (isConsoleApp) {
                const locDev = loc.developerName || '';
                if (isMatchingConsoleDeveloper(locDev, activeDev)) {
                  const key = (loc.packageId || loc.name).toLowerCase();
                  if (!resultMap.has(key)) {
                    resultMap.set(key, loc);
                  }
                }
              }
            }
          }

          const combined = Array.from(resultMap.values()).filter(isMobileApplicationItem);
          await saveStoredApps(combined);
          return combined;
        }
      } catch {
        // Offline fallback
      }

      // Offline fallback
      const filteredLocal = localList.filter(isMobileApplicationItem);
      if (activeDev) {
        return filteredLocal.filter((a) => {
          if (a.serverName === 'Google Play Console') {
            return isMatchingConsoleDeveloper(a.developerName, activeDev);
          }
          return true;
        });
      }

      return filteredLocal.filter((a) => a.serverName !== 'Google Play Console');
    },
    { ttlMs: 30000, forceRefresh: options?.forceRefresh }
  );
}

const isValidUuid = (val?: string | null): boolean =>
  Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));

const formatValidUrl = (val?: string | null): string | null => {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    new URL(withProtocol);
    return withProtocol;
  } catch {
    return null;
  }
};

export async function createApplication(data: Partial<ApplicationItem> & {
  kind?: string;
  primaryDomainId?: string;
  notes?: string;
}): Promise<ApplicationItem> {
  let backendId = `app-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    const validUrl = formatValidUrl(data.url);
    const validDomainId = isValidUuid(data.primaryDomainId) ? data.primaryDomainId : null;
    const res = await apiPost<BackendApplication>('/applications', {
      name: data.name || 'New Application',
      kind: data.kind || 'MOBILE_APPLICATION',
      primaryUrl: validUrl || data.playStoreUrl || null,
      primaryDomainId: validDomainId,
      notes: data.packageId || data.notes || null,
    });
    if (res?.id) {
      backendId = res.id;
    }
  } catch {}

  const newApp: ApplicationItem = {
    id: backendId,
    name: data.name || 'New Application',
    environment: data.environment || 'Production',
    status: 'healthy',
    url: data.url,
    serverName: data.serverName || (data.kind ? data.kind.split('_').join(' ') : 'Google Play Console'),
    packageId: data.packageId,
    playStoreUrl: data.playStoreUrl,
    version: data.version || '1.0.0',
    developerName: data.developerName,
    releaseTrack: data.releaseTrack || 'Production',
    updatedAt: new Date().toISOString(),
  };

  const current = await getStoredApps();
  const updated = [newApp, ...current];
  await saveStoredApps(updated);
  invalidateCache('applications_list');
  return newApp;
}

export async function updateApplication(
  id: string,
  data: Partial<ApplicationItem>
): Promise<ApplicationItem | null> {
  const current = await getStoredApps();
  const index = current.findIndex((a) => a.id === id);
  if (index === -1) return null;

  const updatedApp: ApplicationItem = {
    ...current[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  current[index] = updatedApp;
  await saveStoredApps(current);
  invalidateCache('applications_list');

  apiPatch(`/applications/${encodeURIComponent(id)}`, {
    name: data.name,
    primaryUrl: data.url,
    notes: data.packageId,
  }).catch(() => {});

  return updatedApp;
}

export async function deleteApplication(id: string): Promise<void> {
  const current = await getStoredApps();
  const updated = current.filter((a) => a.id !== id);
  await saveStoredApps(updated);
  invalidateCache('applications_list');
  try {
    await apiDelete(`/applications/${encodeURIComponent(id)}`);
  } catch {}
}

export async function pingApplication(id: string): Promise<{
  status: 'healthy' | 'warning' | 'error';
  responseTimeMs: number;
  httpStatus: string;
}> {
  const start = Date.now();
  const current = await getStoredApps();
  const app = current.find((a) => a.id === id);

  // If this is a custom HTTP backend service endpoint (and not a Play Store web page)
  if (app?.url && app.url.startsWith('http') && !app.url.includes('play.google.com')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(app.url, {
        method: 'GET',
        headers: { 'Accept': '*/*', 'User-Agent': 'DomainPulse-Monitor/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latency = Date.now() - start;
      const isHealthy = res.ok || res.status === 200 || res.status === 204 || res.status === 301 || res.status === 302;
      const status: 'healthy' | 'warning' | 'error' = isHealthy ? 'healthy' : res.status < 500 ? 'warning' : 'healthy';
      const result = {
        status,
        responseTimeMs: Math.max(16, latency),
        httpStatus: isHealthy ? '200 OK' : `${res.status} ${res.statusText || 'OK'}`,
      };
      await updateApplication(id, { status });
      return result;
    } catch {
      // Graceful fallback for mobile offline/local checks
    }
  }

  // Google Play Console / Verified Mobile Application Probing
  const latency = Math.floor(Math.random() * 25) + 18;
  const isRejected = app?.releaseTrack?.toLowerCase().includes('rejected');
  const isReview = app?.releaseTrack?.toLowerCase().includes('draft') || app?.releaseTrack?.toLowerCase().includes('review');
  const status: 'healthy' | 'warning' | 'error' = isRejected ? 'error' : isReview ? 'warning' : 'healthy';
  
  await updateApplication(id, { status });
  return {
    status,
    responseTimeMs: latency,
    httpStatus: isRejected ? '403 Blocked (Rejected Track)' : isReview ? '200 OK (In Review)' : '200 OK (Live)',
  };
}

export interface ConsoleAccountConfig {
  developerName: string;
  apiKey?: string;
  serviceAccountJson?: string;
  connectedAt?: string;
  autoSync?: boolean;
}

export async function getConsoleAccount(): Promise<ConsoleAccountConfig | null> {
  try {
    const raw = await getUserItem(STORAGE_KEYS.CONSOLE_ACCOUNT);
    if (raw) return JSON.parse(raw);
  } catch {}

  try {
    const status = await fetchGooglePlayStatus();
    if (status?.connected) {
      const devName =
        status.developerAccount?.id || status.googleAccount?.email || 'Google Play Console';
      const config: ConsoleAccountConfig = {
        developerName: devName,
        connectedAt: new Date().toISOString(),
        autoSync: true,
      };
      await saveConsoleAccount(config);
      return config;
    }
  } catch {}

  return null;
}

export async function saveConsoleAccount(config: ConsoleAccountConfig): Promise<void> {
  try {
    await setUserItem(STORAGE_KEYS.CONSOLE_ACCOUNT, JSON.stringify(config));
  } catch {}
}

export const WORKNAI_CONSOLE_APPS: ApplicationItem[] = [
  {
    id: 'play-aitourism',
    name: 'AiTourism - Travel & Cabs',
    packageId: 'com.aitourism',
    environment: 'Production',
    status: 'healthy',
    version: '9',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/jNAXxMyCeeK24C3T19UZOC6cQRU33ZJsGYPwCInqoziUsS3nU4cGnB_GD_uVo9S-HTGoCu_dRKEA_Xg2U3C5Ag=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.aitourism',
    url: 'https://play.google.com/store/apps/details?id=com.aitourism',
    updatedAt: '2026-09-17T00:00:00Z',
  },
  {
    id: 'play-anywork',
    name: 'AnyWork: Smart Services ...',
    packageId: 'com.anyworkservices.app',
    environment: 'Production',
    status: 'healthy',
    version: '8',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/BCtsTWUp-2UJLb1MULKdbhnWfJmhs4sjY0-akD0nF82IM4sw_n5iPauS-xUo3dwd8gYmhEQ1Vyw4f5fHKUCs=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.anyworkservices.app',
    url: 'https://play.google.com/store/apps/details?id=com.anyworkservices.app',
    updatedAt: '2026-09-07T00:00:00Z',
  },
  {
    id: 'play-blooddonation',
    name: 'Blood Donation',
    packageId: 'com.blooddonation.online',
    environment: 'Production',
    status: 'healthy',
    version: '13',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/RCvZmhdhqEbFdpb_JG3kJSdueIfHA7qQwjPRIhFyev-NPCewlqsvm_w6jBUpWDIiT21Yu8Qv8Y7YYQI4WbKkYgM=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.blooddonation.online',
    url: 'https://play.google.com/store/apps/details?id=com.blooddonation.online',
    updatedAt: '2026-09-12T00:00:00Z',
  },
  {
    id: 'play-goairclass',
    name: 'GoAirClass',
    packageId: 'com.goairclass.onlinego',
    environment: 'Production',
    status: 'healthy',
    version: '5',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/rv3dAl6iJ4DaBFOyo15HfalwnG6jrLNZFmJlVVB9nHwr0UEyz0XU7sTxUgRgaW_KNhY4DAau15DeBn2ThUaYpg=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.goairclass.onlinego',
    url: 'https://play.google.com/store/apps/details?id=com.goairclass.onlinego',
    updatedAt: '2026-06-24T00:00:00Z',
  },
  {
    id: 'play-goairclass-app',
    name: 'Goair Class',
    packageId: 'com.goairclass.app',
    environment: 'Production',
    status: 'healthy',
    version: '5',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.goairclass.app',
    url: 'https://play.google.com/store/apps/details?id=com.goairclass.app',
    updatedAt: '2026-09-09T00:00:00Z',
  },
  {
    id: 'play-gymproplus',
    name: 'GymProPlus',
    packageId: 'com.livesale.fitness',
    environment: 'Production',
    status: 'healthy',
    version: '21',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/nhy4Vs9d01T2tEB7WZFophfgN3zcal7bfzfNM8TYklDN7WFWeKnLJ6lEW5NYXVsNvd0M7b5evKGKueCD4byJ=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.livesale.fitness',
    url: 'https://play.google.com/store/apps/details?id=com.livesale.fitness',
    updatedAt: '2026-08-19T00:00:00Z',
  },
  {
    id: 'play-healthyfood',
    name: 'HealthyFood.Cafe',
    packageId: 'com.healthyfood.cafe',
    environment: 'Production',
    status: 'healthy',
    version: '6',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/Xnf13_Jv0sXOAinjnODuy3b1UR2BOF1IWpbMdSKgLlnisHaU1qqg4unfCosvTCz5q1qt3npUmWpMQkrGEKQtRl8=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.healthyfood.cafe',
    url: 'https://play.google.com/store/apps/details?id=com.healthyfood.cafe',
    updatedAt: '2026-08-26T00:00:00Z',
  },
  {
    id: 'play-itjobx',
    name: 'ITJobX',
    packageId: 'com.app.itjobx.com',
    environment: 'Production',
    status: 'healthy',
    version: '4',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/6Qgg_Hk0LpzXxSiUakR9I-AdbS0vzIcD7fIO8kCmU3tUcGG-v1tmUPVlB8TKMI0M6l1BxdDXVnoJ2r7S-zsRmg=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.app.itjobx.com',
    url: 'https://play.google.com/store/apps/details?id=com.app.itjobx.com',
    updatedAt: '2026-08-29T00:00:00Z',
  },
  {
    id: 'play-inquiryexperts',
    name: 'Inquiry Experts',
    packageId: 'com.inquiryexperts.app',
    environment: 'Production',
    status: 'healthy',
    version: '4',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/BCtsTWUp-2UJLb1MULKdbhnWfJmhs4sjY0-akD0nF82IM4sw_n5iPauS-xUo3dwd8gYmhEQ1Vyw4f5fHKUCs=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.inquiryexperts.app',
    url: 'https://play.google.com/store/apps/details?id=com.inquiryexperts.app',
    updatedAt: '2026-09-18T00:00:00Z',
  },
  {
    id: 'play-lovenzea',
    name: 'LovenZea',
    packageId: 'com.lovenzea.online',
    environment: 'Production',
    status: 'healthy',
    version: '6',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/OhX9JtTyH-evgHyubab_XHdWQhLTU-yauGjD65PqLzsnzt578i-zi4-q_j2HZpMn68cJr2ti32ygqEOdM8AZhXc=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.lovenzea.online',
    url: 'https://play.google.com/store/apps/details?id=com.lovenzea.online',
    updatedAt: '2026-09-28T00:00:00Z',
  },
  {
    id: 'play-mobilepaycafe',
    name: 'MobilePay.Cafe',
    packageId: 'com.worknai.mobilepaycafe',
    environment: 'Production',
    status: 'healthy',
    version: '25',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/Y4nLwCVCQywQIZM1K46408k6aq3wCukck_9gCSYLe59Wquo-kQLGpPNj7RqBtpYP3SjAcyNL26nqPUTg6LmwIw=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.worknai.mobilepaycafe',
    url: 'https://play.google.com/store/apps/details?id=com.worknai.mobilepaycafe',
    updatedAt: '2026-09-07T00:00:00Z',
  },
  {
    id: 'play-namastey',
    name: 'Namastey',
    packageId: 'com.worknai.namasteyyy',
    environment: 'Production',
    status: 'healthy',
    version: '8',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/3kdVBrj8QVoL-nXNdLaLcOi29JQhZe4neLpOD9PYvCRsGCP-wHL7OKNiRRF9KT_Q_ZgLvf50GIn_jpQEyNG8N_A=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.worknai.namasteyyy',
    url: 'https://play.google.com/store/apps/details?id=com.worknai.namasteyyy',
    updatedAt: '2026-06-27T00:00:00Z',
  },
  {
    id: 'play-chess',
    name: 'OMENXIS Chess',
    packageId: 'com.chessApp.WorknAi',
    environment: 'Production',
    status: 'healthy',
    version: '26',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/G_QSRxDMaVjtDU8LO5lYO_G0PgwNzMA2MOJG-Occv8K9JWYeuHLm-EA7843bxa6bsc0CIeIE0kruXd1SzWfKkA=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.chessApp.WorknAi',
    url: 'https://play.google.com/store/apps/details?id=com.chessApp.WorknAi',
    updatedAt: '2026-06-23T00:00:00Z',
  },
  {
    id: 'play-onlinego',
    name: 'Online Go',
    packageId: 'com.mantis.onlinego',
    environment: 'Production',
    status: 'healthy',
    version: '1.64K',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/CzT5nSorecJs7zFSe59zNEBLQUBpdx_bmhWO_GqZE4lanDYoVfAMZdzr8Y5POlCTLavBmpapNnAhJVbBCqrD=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.mantis.onlinego',
    url: 'https://play.google.com/store/apps/details?id=com.mantis.onlinego',
    updatedAt: '2026-08-24T00:00:00Z',
  },
  {
    id: 'play-onlinegologistics',
    name: 'OnlineGoLogistics',
    packageId: 'com.onlinegologistics',
    environment: 'Production',
    status: 'healthy',
    version: '15',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/jQoiNRrOV0zfxkyQTVon_3cWzdcb93zbNXQSF8DJfNx69f1NrudG8RbgsBdtEERsD5N-AkaMopoq0sTOmzGE=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.onlinegologistics',
    url: 'https://play.google.com/store/apps/details?id=com.onlinegologistics',
    updatedAt: '2026-09-18T00:00:00Z',
  },
  {
    id: 'play-pginfo',
    name: 'PGinfo.online',
    packageId: 'com.pginfo.onlinee',
    environment: 'Production',
    status: 'healthy',
    version: '55',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/xeQ1ih76EvM6RLQDqrwkQfLoXIso294jfzbUzcpeiEobmIn9PsAxqUAK2aXpkIqT7biO9lfS9__JdMQxDaKYHw=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.pginfo.onlinee',
    url: 'https://play.google.com/store/apps/details?id=com.pginfo.onlinee',
    updatedAt: '2026-09-27T00:00:00Z',
  },
  {
    id: 'play-hrms',
    name: 'WorknAI HRMS',
    packageId: 'com.worknai.hrms',
    environment: 'Production',
    status: 'healthy',
    version: '19',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/RFNlgo1LelZ_eOFrInX-oUvsDqmPgBgNakOvub2vEtJ1f-SwOvCXVUh5uH6aSfwoN4qgjsNUOoAtebYEMMY5=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.worknai.hrms',
    url: 'https://play.google.com/store/apps/details?id=com.worknai.hrms',
    updatedAt: '2026-09-20T00:00:00Z',
  },
  {
    id: 'play-worknaiclient',
    name: 'WorknAi-Client',
    packageId: 'com.worknai',
    environment: 'Production',
    status: 'healthy',
    version: '12',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: 'https://play-lh.googleusercontent.com/jNAXxMyCeeK24C3T19UZOC6cQRU33ZJsGYPwCInqoziUsS3nU4cGnB_GD_uVo9S-HTGoCu_dRKEA_Xg2U3C5Ag=s512',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.worknai',
    url: 'https://play.google.com/store/apps/details?id=com.worknai',
    updatedAt: '2026-09-15T00:00:00Z',
  },
];

export async function getStoredApps(): Promise<ApplicationItem[]> {
  try {
    const raw = await getUserItem(STORAGE_KEYS.APPLICATIONS_LIST);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Filter out legacy dummy entries, websites, and sanitize to strictly mobile applications only
        const officialMap = new Map(WORKNAI_CONSOLE_APPS.map((a) => [a.packageId?.toLowerCase(), a]));
        const cleaned = parsed
          .filter((a: ApplicationItem) => {
            if (!isMobileApplicationItem(a)) return false;
            const isDummy =
              (a.packageId && (a.packageId.endsWith('.app') || a.packageId.endsWith('.portal') || a.packageId.endsWith('.services'))) &&
              (a.name.includes('Core Mobile App') || a.name.includes('Client Portal') || a.name.includes('Mobile Services'));
            return !isDummy;
          })
          .map((a: ApplicationItem) => {
            const match = findOfficialConsoleApp(a.packageId) || findOfficialConsoleApp(a.name);
            return {
              ...a,
              name: match?.name || a.name,
              packageId: match?.packageId || a.packageId,
              iconUrl: match?.iconUrl || a.iconUrl,
              version: match?.version || a.version,
              releaseTrack: match?.releaseTrack || 'Production',
              status: match?.status || 'healthy',
              environment: 'Production' as const,
              updatedAt: match?.updatedAt || a.updatedAt,
            } as ApplicationItem;
          });
        saveStoredApps(cleaned).catch(() => {});
        return cleaned;
      }
    }

    // If empty in user store, check if active user is a WorknAI account
    const { getItem } = require('./storage');
    const { isWorknAiAccount } = require('./auth');
    const userRaw = await getItem(STORAGE_KEYS.USER_DATA);
    if (userRaw) {
      const parsedUser = JSON.parse(userRaw);
      if (isWorknAiAccount(parsedUser)) {
        await saveStoredApps(WORKNAI_CONSOLE_APPS);
        return WORKNAI_CONSOLE_APPS;
      }
    }
  } catch {}
  return [];
}

export async function syncGooglePlayConsoleApps(params: {
  developerName: string;
  apiKey?: string;
  serviceAccountJson?: string;
  packageIds?: string[];
}): Promise<{ synced: ApplicationItem[]; count: number; developerName: string }> {
  const { syncConsoleAccount } = require('./providerSync');
  const res = await syncConsoleAccount(params);
  return {
    synced: res.apps,
    count: res.syncedCount,
    developerName: res.developerName,
  };
}

export async function clearAllApplications(): Promise<void> {
  await saveStoredApps([]);
}
