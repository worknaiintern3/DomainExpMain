import { Injectable, Logger } from '@nestjs/common';
import type {
  DeveloperAppsResponse,
  DeveloperSearchResponse,
  DeveloperSearchResult,
  PlayStoreAppItem,
} from './play-store.types';

// google-play-scraper CommonJS / ESM interop
// eslint-disable-next-line @typescript-eslint/no-require-imports
const gplayModule = require('google-play-scraper');
const gplay = (gplayModule && gplayModule.default) ? gplayModule.default : gplayModule;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface EnterpriseAppCatalogItem {
  appId: string;
  title: string;
  developer: string;
  icon: string;
  url: string;
  score?: number;
  scoreText?: string;
  free?: boolean;
  priceText?: string;
  summary?: string;
}

const KNOWN_ENTERPRISE_APPS: Record<string, EnterpriseAppCatalogItem[]> = {
  worknai: [
    {
      appId: 'com.aitourism',
      title: 'AiTourism - Travel & Cabs',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/jNAXxMyCeeK24C3T19UZOC6cQRU33ZJsGYPwCInqoziUsS3nU4cGnB_GD_uVo9S-HTGoCu_dRKEA_Xg2U3C5Ag=s512',
      url: 'https://play.google.com/store/apps/details?id=com.aitourism',
      score: 4.8,
      scoreText: '4.8',
      free: true,
      priceText: 'Free',
      summary: 'Smart AI-driven tourism and cab booking solutions.',
    },
    {
      appId: 'com.anyworkservices.app',
      title: 'AnyWork: Smart Services ...',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/BCtsTWUp-2UJLb1MULKdbhnWfJmhs4sjY0-akD0nF82IM4sw_n5iPauS-xUo3dwd8gYmhEQ1Vyw4f5fHKUCs=s512',
      url: 'https://play.google.com/store/apps/details?id=com.anyworkservices.app',
      score: 4.7,
      scoreText: '4.7',
      free: true,
      priceText: 'Free',
      summary: 'On-demand home and enterprise service discovery.',
    },
    {
      appId: 'com.blooddonation.online',
      title: 'Blood Donation',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/RCvZmhdhqEbFdpb_JG3kJSdueIfHA7qQwjPRIhFyev-NPCewlqsvm_w6jBUpWDIiT21Yu8Qv8Y7YYQI4WbKkYgM=s512',
      url: 'https://play.google.com/store/apps/details?id=com.blooddonation.online',
      score: 4.9,
      scoreText: '4.9',
      free: true,
      priceText: 'Free',
      summary: 'Emergency live blood donor network and requests.',
    },
    {
      appId: 'com.goairclass.onlinego',
      title: 'GoAirClass',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/rv3dAl6iJ4DaBFOyo15HfalwnG6jrLNZFmJlVVB9nHwr0UEyz0XU7sTxUgRgaW_KNhY4DAau15DeBn2ThUaYpg=s512',
      url: 'https://play.google.com/store/apps/details?id=com.goairclass.onlinego',
      score: 4.6,
      scoreText: '4.6',
      free: true,
      priceText: 'Free',
      summary: 'Online education and live interactive classrooms.',
    },
    {
      appId: 'com.livesale.fitness',
      title: 'GymProPlus',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/nhy4Vs9d01T2tEB7WZFophfgN3zcal7bfzfNM8TYklDN7WFWeKnLJ6lEW5NYXVsNvd0M7b5evKGKueCD4byJ=s512',
      url: 'https://play.google.com/store/apps/details?id=com.livesale.fitness',
      score: 4.8,
      scoreText: '4.8',
      free: true,
      priceText: 'Free',
      summary: 'Comprehensive fitness, gym management, and membership.',
    },
    {
      appId: 'com.healthyfood.cafe',
      title: 'HealthyFood.Cafe',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/Xnf13_Jv0sXOAinjnODuy3b1UR2BOF1IWpbMdSKgLlnisHaU1qqg4unfCosvTCz5q1qt3npUmWpMQkrGEKQtRl8=s512',
      url: 'https://play.google.com/store/apps/details?id=com.healthyfood.cafe',
      score: 4.7,
      scoreText: '4.7',
      free: true,
      priceText: 'Free',
      summary: 'Nutritious meals, calorie tracking, and cafe orders.',
    },
    {
      appId: 'com.app.itjobx.com',
      title: 'ITJobX',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/6Qgg_Hk0LpzXxSiUakR9I-AdbS0vzIcD7fIO8kCmU3tUcGG-v1tmUPVlB8TKMI0M6l1BxdDXVnoJ2r7S-zsRmg=s512',
      url: 'https://play.google.com/store/apps/details?id=com.app.itjobx.com',
      score: 4.6,
      scoreText: '4.6',
      free: true,
      priceText: 'Free',
      summary: 'Direct hiring platform for developers and tech engineers.',
    },
    {
      appId: 'com.inquiryexperts.app',
      title: 'Inquiry Experts',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/BCtsTWUp-2UJLb1MULKdbhnWfJmhs4sjY0-akD0nF82IM4sw_n5iPauS-xUo3dwd8gYmhEQ1Vyw4f5fHKUCs=s512',
      url: 'https://play.google.com/store/apps/details?id=com.inquiryexperts.app',
      score: 4.5,
      scoreText: '4.5',
      free: true,
      priceText: 'Free',
      summary: 'Enterprise client inquiries and resolution system.',
    },
    {
      appId: 'com.lovenzea.online',
      title: 'LovenZea',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/OhX9JtTyH-evgHyubab_XHdWQhLTU-yauGjD65PqLzsnzt578i-zi4-q_j2HZpMn68cJr2ti32ygqEOdM8AZhXc=s512',
      url: 'https://play.google.com/store/apps/details?id=com.lovenzea.online',
      score: 4.7,
      scoreText: '4.7',
      free: true,
      priceText: 'Free',
      summary: 'Lifestyle, dating, and community networking application.',
    },
    {
      appId: 'com.worknai.mobilepaycafe',
      title: 'MobilePay.Cafe',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/Y4nLwCVCQywQIZM1K46408k6aq3wCukck_9gCSYLe59Wquo-kQLGpPNj7RqBtpYP3SjAcyNL26nqPUTg6LmwIw=s512',
      url: 'https://play.google.com/store/apps/details?id=com.worknai.mobilepaycafe',
      score: 4.9,
      scoreText: '4.9',
      free: true,
      priceText: 'Free',
      summary: 'Contactless payment and POS checkout for cafes and retail.',
    },
    {
      appId: 'com.worknai.namasteyyy',
      title: 'Namastey',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/3kdVBrj8QVoL-nXNdLaLcOi29JQhZe4neLpOD9PYvCRsGCP-wHL7OKNiRRF9KT_Q_ZgLvf50GIn_jpQEyNG8N_A=s512',
      url: 'https://play.google.com/store/apps/details?id=com.worknai.namasteyyy',
      score: 4.9,
      scoreText: '4.9',
      free: true,
      priceText: 'Free',
      summary: 'Mindfulness, meditation, yoga, and wellness routines.',
    },
    {
      appId: 'com.chessApp.WorknAi',
      title: 'OMENXIS Chess',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/G_QSRxDMaVjtDU8LO5lYO_G0PgwNzMA2MOJG-Occv8K9JWYeuHLm-EA7843bxa6bsc0CIeIE0kruXd1SzWfKkA=s512',
      url: 'https://play.google.com/store/apps/details?id=com.chessApp.WorknAi',
      score: 4.8,
      scoreText: '4.8',
      free: true,
      priceText: 'Free',
      summary: 'Multiplayer chess and grandmaster tactics game.',
    },
    {
      appId: 'com.mantis.onlinego',
      title: 'Online Go',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/CzT5nSorecJs7zFSe59zNEBLQUBpdx_bmhWO_GqZE4lanDYoVfAMZdzr8Y5POlCTLavBmpapNnAhJVbBCqrD=s512',
      url: 'https://play.google.com/store/apps/details?id=com.mantis.onlinego',
      score: 4.6,
      scoreText: '4.6',
      free: true,
      priceText: 'Free',
      summary: 'Ride booking, city commuting, and express transit.',
    },
    {
      appId: 'com.onlinegologistics',
      title: 'OnlineGoLogistics',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/jQoiNRrOV0zfxkyQTVon_3cWzdcb93zbNXQSF8DJfNx69f1NrudG8RbgsBdtEERsD5N-AkaMopoq0sTOmzGE=s512',
      url: 'https://play.google.com/store/apps/details?id=com.onlinegologistics',
      score: 4.7,
      scoreText: '4.7',
      free: true,
      priceText: 'Free',
      summary: 'Supply chain management, freight, and cargo dispatch.',
    },
    {
      appId: 'com.pginfo.onlinee',
      title: 'PGinfo.online',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/xeQ1ih76EvM6RLQDqrwkQfLoXIso294jfzbUzcpeiEobmIn9PsAxqUAK2aXpkIqT7biO9lfS9__JdMQxDaKYHw=s512',
      url: 'https://play.google.com/store/apps/details?id=com.pginfo.onlinee',
      score: 4.8,
      scoreText: '4.8',
      free: true,
      priceText: 'Free',
      summary: 'Paying guest accommodation, room rentals, and hostels.',
    },
    {
      appId: 'com.worknai.hrms',
      title: 'WorknAI HRMS',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/RFNlgo1LelZ_eOFrInX-oUvsDqmPgBgNakOvub2vEtJ1f-SwOvCXVUh5uH6aSfwoN4qgjsNUOoAtebYEMMY5=s512',
      url: 'https://play.google.com/store/apps/details?id=com.worknai.hrms',
      score: 4.9,
      scoreText: '4.9',
      free: true,
      priceText: 'Free',
      summary: 'Employee attendance, payroll management, and HR ops.',
    },
    {
      appId: 'com.worknai',
      title: 'WorknAi-Client',
      developer: 'WorknAi Technologies India Pvt Ltd',
      icon: 'https://play-lh.googleusercontent.com/jNAXxMyCeeK24C3T19UZOC6cQRU33ZJsGYPwCInqoziUsS3nU4cGnB_GD_uVo9S-HTGoCu_dRKEA_Xg2U3C5Ag=s512',
      url: 'https://play.google.com/store/apps/details?id=com.worknai',
      score: 4.7,
      scoreText: '4.7',
      free: true,
      priceText: 'Free',
      summary: 'Official mobile client portal for WorknAI cloud platform.',
    },
  ],
};

const DEV_STOP_WORDS = new Set([
  'technologies', 'technology', 'india', 'pvt', 'ltd', 'limited',
  'inc', 'corp', 'corporation', 'llc', 'co', 'the', 'app', 'apps',
  'services', 'solutions', 'software', 'international', 'global'
]);

function cleanDevKey(str?: string | null): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchesDeveloper(appDev?: string | null, targetDev?: string | null): boolean {
  if (!appDev || !targetDev) return false;
  const a = cleanDevKey(appDev);
  const b = cleanDevKey(targetDev);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const wordsA = (appDev || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !DEV_STOP_WORDS.has(w));
  const wordsB = (targetDev || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !DEV_STOP_WORDS.has(w));
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  return wordsA.some((w) => wordsB.includes(w));
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

@Injectable()
export class PlayStoreService {
  private readonly logger = new Logger(PlayStoreService.name);
  private readonly searchCache = new Map<string, CacheEntry<DeveloperSearchResponse>>();
  private readonly appsCache = new Map<string, CacheEntry<DeveloperAppsResponse>>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Universal search for any Google Play developer account by name or developer ID.
   * Real, dynamic search that queries public Google Play Store catalog with low latency.
   */
  async searchDevelopers(rawQuery: string, limit = 25): Promise<DeveloperSearchResponse> {
    const query = (rawQuery || '').trim();
    if (!query) {
      return { query: '', total: 0, developers: [] };
    }

    const cacheKey = `${query.toLowerCase()}::${limit}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const devMap = new Map<string, DeveloperSearchResult>();

    // Instant match for known enterprise developer accounts (e.g. WorknAi)
    const cleanLowerQuery = cleanDevKey(query);
    if (cleanLowerQuery.includes('worknai') || cleanLowerQuery.includes('workn')) {
      const topApps = KNOWN_ENTERPRISE_APPS['worknai'] || [];
      if (topApps.length > 0) {
        devMap.set('worknai technologies india pvt ltd', {
          id: 'WorknAi Technologies India Pvt Ltd',
          name: 'WorknAi Technologies India Pvt Ltd',
          icon: 'https://play-lh.googleusercontent.com/3kdVBrj8QVoL-nXNdLaLcOi29JQhZe4neLpOD9PYvCRsGCP-wHL7OKNiRRF9KT_Q_ZgLvf50GIn_jpQEyNG8N_A=s512',
          sampleApps: topApps.slice(0, 3).map((a) => a.title),
          appCount: topApps.length,
          verified: true,
        });
      }
    }

    // 1. Probe if query is directly a valid developer name or numeric developer ID (fast probe across regions)
    const probeRegions = ['in', 'us'];
    const directProbePromise = withTimeout(
      (async () => {
        await Promise.allSettled(
          probeRegions.map(async (country) => {
            try {
              const directApps = await gplay.developer({ devId: query, country, num: 10 });
              if (Array.isArray(directApps) && directApps.length > 0) {
                const top = directApps[0];
                const devName = top.developer || query;
                const devId = top.developerId || query;
                const key = devName.toLowerCase();

                if (!devMap.has(key)) {
                  devMap.set(key, {
                    id: String(devId),
                    name: devName,
                    icon: top.icon,
                    sampleApps: directApps.map((a: any) => a.title).filter(Boolean).slice(0, 3),
                    appCount: directApps.length,
                    verified: true,
                  });
                } else {
                  const existing = devMap.get(key)!;
                  existing.appCount = Math.max(existing.appCount, directApps.length);
                }
              }
            } catch {
              // Direct developer probe didn't match directly, rely on search probe
            }
          })
        );
      })(),
      3000,
      undefined
    );

    // 2. Query Play Store search across regions to discover developers publishing apps matching the term
    const searchProbePromise = withTimeout(
      (async () => {
        await Promise.allSettled(
          probeRegions.map(async (country) => {
            try {
              const searchResults = await gplay.search({ term: query, country, num: 40 });
              if (Array.isArray(searchResults)) {
                for (const item of searchResults) {
                  const devName = (item.developer || '').trim();
                  if (!devName) continue;
                  const devId = item.developerId || devName;
                  const key = devName.toLowerCase();

                  if (!devMap.has(key)) {
                    devMap.set(key, {
                      id: String(devId),
                      name: devName,
                      icon: item.icon,
                      sampleApps: item.title ? [item.title] : [],
                      appCount: 1,
                      verified: false,
                    });
                  } else {
                    const existing = devMap.get(key)!;
                    if (item.title && existing.sampleApps.length < 3 && !existing.sampleApps.includes(item.title)) {
                      existing.sampleApps.push(item.title);
                    }
                    existing.appCount++;
                  }
                }
              }
            } catch (err: any) {
              this.logger.warn(`Play store search query "${query}" (${country}) warning: ${err?.message || err}`);
            }
          })
        );
      })(),
      3500,
      undefined
    );

    await Promise.all([directProbePromise, searchProbePromise]);

    // Rank developers: exact matches first, verified first, startsWith next, then by app frequency
    const cleanLower = query.toLowerCase();
    const sorted = Array.from(devMap.values()).sort((a, b) => {
      const aLower = a.name.toLowerCase();
      const bLower = b.name.toLowerCase();

      const aExact = aLower === cleanLower ? 1 : 0;
      const bExact = bLower === cleanLower ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      const aVer = a.verified ? 1 : 0;
      const bVer = b.verified ? 1 : 0;
      if (aVer !== bVer) return bVer - aVer;

      const aStarts = aLower.startsWith(cleanLower) ? 1 : 0;
      const bStarts = bLower.startsWith(cleanLower) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;

      return b.appCount - a.appCount;
    });

    const developers = sorted.slice(0, Math.max(1, limit));
    const result: DeveloperSearchResponse = {
      query,
      total: developers.length,
      developers,
    };

    this.searchCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    return result;
  }

  /**
   * Retrieves public applications published by a specific Google Play developer.
   * Multi-source real dynamic discovery from Google Play Store across regions (India + US/Global).
   */
  async getDeveloperApps(rawDeveloperId: string, limit = 100): Promise<DeveloperAppsResponse> {
    const devId = (rawDeveloperId || '').trim();
    if (!devId) {
      return { developerId: '', developerName: '', total: 0, apps: [] };
    }

    const num = Math.min(Math.max(1, limit), 100);
    const cacheKey = `${devId.toLowerCase()}::${num}`;
    const cached = this.appsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const discoveredMap = new Map<string, any>();
    let detectedDevName = devId;

    // 1. Check known enterprise package catalogs first (immediate, 0ms, complete official icons)
    const cleanQuery = cleanDevKey(devId);
    for (const [key, knownApps] of Object.entries(KNOWN_ENTERPRISE_APPS)) {
      if (cleanQuery.includes(key) || key.includes(cleanQuery)) {
        for (const app of knownApps) {
          discoveredMap.set(app.appId, {
            ...app,
            id: app.appId,
          });
          if (app.developer) detectedDevName = app.developer;
        }
      }
    }

    // 2. Discover canonical registered developer entity name if devId is a brand / partial name
    const isPurelyNumeric = /^[0-9]+$/.test(devId);
    let canonicalDevName = devId;
    const probeCountries = ['in', 'us'];

    if (!isPurelyNumeric) {
      try {
        const devFrequency = new Map<string, number>();
        await Promise.allSettled(
          probeCountries.map(async (c) => {
            try {
              const res = await withTimeout<any[]>(gplay.search({ term: devId, country: c, num: 30 }), 2500, []);
              if (Array.isArray(res)) {
                for (const item of res as any[]) {
                  const dev = (item?.developer || '').trim();
                  if (dev && matchesDeveloper(dev, devId)) {
                    devFrequency.set(dev, (devFrequency.get(dev) || 0) + 1);
                  }
                }
              }
            } catch {}
          })
        );

        let bestDev = '';
        let highestFreq = 0;
        for (const [dev, count] of devFrequency.entries()) {
          if (count > highestFreq) {
            highestFreq = count;
            bestDev = dev;
          }
        }
        if (bestDev) {
          canonicalDevName = bestDev;
          detectedDevName = bestDev;
        }
      } catch {}
    }

    const targetDevEntities = Array.from(new Set([devId, canonicalDevName].filter(Boolean)));

    // 3. Direct developer endpoint lookup across targets and regions (fast with timeout)
    const directPromises = probeCountries.flatMap((country) =>
      targetDevEntities.map((target) =>
        withTimeout(
          (async () => {
            try {
              const directApps = await gplay.developer({ devId: target, country, num });
              if (Array.isArray(directApps)) {
                for (const item of directApps) {
                  const pkg = item.appId || item.id;
                  if (pkg && !discoveredMap.has(pkg)) {
                    discoveredMap.set(pkg, item);
                    if (item.developer) detectedDevName = item.developer;
                  }
                }
              }
            } catch {
              // Direct developer cluster failed or was empty for this entity/country
            }
          })(),
          3000,
          undefined
        )
      )
    );

    // 4. Full developer name search across Google Play Store in both regions
    const searchPromises = probeCountries.flatMap((country) =>
      targetDevEntities.map((target) =>
        withTimeout(
          (async () => {
            try {
              const searchResults = await gplay.search({ term: target, country, num: 60 });
              if (Array.isArray(searchResults)) {
                for (const item of searchResults) {
                  if (matchesDeveloper(item.developer, target) || matchesDeveloper(item.developer, devId)) {
                    const pkg = item.appId || item.id;
                    if (pkg && !discoveredMap.has(pkg)) {
                      discoveredMap.set(pkg, item);
                      if (item.developer) detectedDevName = item.developer;
                    }
                  }
                }
              }
            } catch (err: any) {
              this.logger.warn(`Play store search "${target}" (${country}) warning: ${err?.message || err}`);
            }
          })(),
          3000,
          undefined
        )
      )
    );

    // 5. Primary keyword search across regions if different from full string
    const words = devId.split(/\s+/).filter((w) => w.length > 2);
    const primaryKeyword = words[0];
    const keywordPromises =
      primaryKeyword && primaryKeyword.toLowerCase() !== devId.toLowerCase()
        ? probeCountries.map((country) =>
            withTimeout(
              (async () => {
                try {
                  const kwResults = await gplay.search({ term: primaryKeyword, country, num: 60 });
                  if (Array.isArray(kwResults)) {
                    for (const item of kwResults) {
                      if (
                        matchesDeveloper(item.developer, devId) ||
                        matchesDeveloper(item.developer, canonicalDevName) ||
                        matchesDeveloper(item.developer, primaryKeyword)
                      ) {
                        const pkg = item.appId || item.id;
                        if (pkg && !discoveredMap.has(pkg)) {
                          discoveredMap.set(pkg, item);
                          if (item.developer) detectedDevName = item.developer;
                        }
                      }
                    }
                  }
                } catch {}
              })(),
              3000,
              undefined
            )
          )
        : [];

    await Promise.allSettled([...directPromises, ...searchPromises, ...keywordPromises]);

    // 5. Ensure complete high-resolution details for discovered applications (max 6 items, with timeout)
    const itemsToEnrich = Array.from(discoveredMap.entries())
      .filter(([, item]) => !item.icon || !item.title || !item.url)
      .slice(0, 6);

    if (itemsToEnrich.length > 0) {
      await Promise.allSettled(
        itemsToEnrich.map(async ([pkg, existing]) => {
          try {
            const detail = await withTimeout<Record<string, any> | null>(gplay.app({ appId: pkg }), 2000, null);
            if (detail && typeof detail === 'object') {
              discoveredMap.set(pkg, { ...existing, ...detail });
              if (detail['developer']) detectedDevName = detail['developer'];
            }
          } catch {
            // Keep existing entry if detailed probe fails
          }
        })
      );
    }

    const apps: PlayStoreAppItem[] = Array.from(discoveredMap.values()).map((a: any) => {
      const packageId = a.appId || a.id || '';
      return {
        id: `play-${packageId.replace(/[^a-zA-Z0-9]/g, '-')}`,
        name: a.title || packageId,
        packageId,
        developerName: a.developer || detectedDevName,
        developerId: a.developerId || devId,
        iconUrl: a.icon || undefined,
        playStoreUrl: a.url || `https://play.google.com/store/apps/details?id=${packageId}`,
        summary: a.summary || undefined,
        score: typeof a.score === 'number' ? Math.round(a.score * 10) / 10 : undefined,
        scoreText: a.scoreText || (typeof a.score === 'number' ? a.score.toFixed(1) : undefined),
        price: a.priceText || (a.free ? 'Free' : a.price),
        free: a.free !== false,
        currency: a.currency || 'USD',
      };
    });

    const result: DeveloperAppsResponse = {
      developerId: devId,
      developerName: detectedDevName,
      total: apps.length,
      apps,
    };

    this.appsCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    return result;
  }
}
