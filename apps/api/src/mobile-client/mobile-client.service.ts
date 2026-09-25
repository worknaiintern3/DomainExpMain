import { Inject, Injectable, Logger } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import {
  mobileAnnouncements,
  mobileAppConfig,
  mobileAppVersions,
  mobileFeatureFlags,
  mobileHomeConfig,
  mobileNavigationConfig,
} from '@domainpulse/database';
import type { MobileBootstrapConfigResponse } from '@domainpulse/contracts';

import { DatabaseService } from '../database/database.service';

const DEFAULT_APP_CONFIG = {
  appName: 'DomainPulse',
  logoUrl: null,
  primaryColor: '#2563EB',
  secondaryColor: '#1E293B',
  maintenanceMode: false,
  maintenanceMessage: null,
};

const DEFAULT_FEATURE_FLAGS = [
  { key: 'domains', name: 'Domains', description: 'Domain portfolio', enabled: true, minAppVersion: null },
  { key: 'servers', name: 'Servers', description: 'VPS & infrastructure', enabled: true, minAppVersion: null },
  { key: 'websites', name: 'Websites', description: 'Web applications', enabled: true, minAppVersion: null },
  { key: 'alerts', name: 'Alerts', description: 'Expiration alerts', enabled: true, minAppVersion: null },
  { key: 'providers', name: 'Providers', description: 'Connected accounts', enabled: true, minAppVersion: null },
  { key: 'infrastructureMap', name: 'Infrastructure Map', description: 'Visual architecture map', enabled: true, minAppVersion: null },
  { key: 'aiDomainFinder', name: 'AI Domain Finder', description: 'Domain search and AI generator', enabled: true, minAppVersion: null },
];

const DEFAULT_NAVIGATION_ITEMS = [
  { key: 'home', label: 'Home', icon: 'home', route: '/home', sortOrder: 1, enabled: true, badge: null },
  { key: 'domains', label: 'Domains', icon: 'globe', route: '/domains', sortOrder: 2, enabled: true, badge: null },
  { key: 'alerts', label: 'Alerts', icon: 'bell', route: '/alerts', sortOrder: 3, enabled: true, badge: null },
  { key: 'settings', label: 'Settings', icon: 'settings', route: '/settings', sortOrder: 4, enabled: true, badge: null },
];

const DEFAULT_HOME_SECTIONS = [
  { sectionKey: 'banner', title: 'Announcements', sortOrder: 1, enabled: true, configJson: null },
  { sectionKey: 'stats', title: 'Overview Metrics', sortOrder: 2, enabled: true, configJson: null },
  { sectionKey: 'quickActions', title: 'Quick Actions', sortOrder: 3, enabled: true, configJson: null },
  { sectionKey: 'alerts', title: 'Urgent Alerts', sortOrder: 4, enabled: true, configJson: null },
  { sectionKey: 'domains', title: 'Expiring Domains', sortOrder: 5, enabled: true, configJson: null },
  { sectionKey: 'servers', title: 'Monitored Infrastructure', sortOrder: 6, enabled: true, configJson: null },
];

const DEFAULT_APP_VERSION = {
  platform: 'all' as const,
  minimumVersion: '1.0.0',
  latestVersion: '1.0.0',
  forceUpdate: false,
  updateUrl: null,
  releaseNotes: null,
};

@Injectable()
export class MobileClientService {
  private readonly logger = new Logger(MobileClientService.name);

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async getBootstrapConfig(): Promise<MobileBootstrapConfigResponse> {
    try {
      const db = this.databaseService.database;

      // 1. App config
    const [configRow] = await db.select().from(mobileAppConfig).limit(1);
    const app = configRow
      ? {
          appName: configRow.appName,
          logoUrl: configRow.logoUrl,
          primaryColor: configRow.primaryColor,
          secondaryColor: configRow.secondaryColor,
          maintenanceMode: configRow.maintenanceMode,
          maintenanceMessage: configRow.maintenanceMessage,
        }
      : DEFAULT_APP_CONFIG;

    // 2. Feature flags
    const flagRows = await db.select().from(mobileFeatureFlags);
    const featureFlags =
      flagRows.length > 0
        ? flagRows.map((f) => ({
            key: f.key,
            name: f.name,
            description: f.description,
            enabled: f.enabled,
            minAppVersion: f.minAppVersion,
          }))
        : DEFAULT_FEATURE_FLAGS;

    const features: Record<string, boolean> = {};
    for (const flag of featureFlags) {
      features[flag.key] = flag.enabled;
    }

    // 3. Navigation
    const navRows = await db
      .select()
      .from(mobileNavigationConfig)
      .orderBy(asc(mobileNavigationConfig.sortOrder));
    const navigation =
      navRows.length > 0
        ? navRows.map((n) => ({
            key: n.key,
            label: n.label,
            icon: n.icon,
            route: n.route,
            sortOrder: n.sortOrder,
            enabled: n.enabled,
            badge: n.badge,
          }))
        : DEFAULT_NAVIGATION_ITEMS;

    // 4. Home sections
    const homeRows = await db
      .select()
      .from(mobileHomeConfig)
      .orderBy(asc(mobileHomeConfig.sortOrder));
    const homeSections =
      homeRows.length > 0
        ? homeRows.map((h) => ({
            sectionKey: h.sectionKey,
            title: h.title,
            sortOrder: h.sortOrder,
            enabled: h.enabled,
            configJson: (h.configJson as Record<string, unknown> | null) ?? null,
          }))
        : DEFAULT_HOME_SECTIONS;

    // 5. Versions
    const [versionRow] = await db.select().from(mobileAppVersions).limit(1);
    const version = versionRow
      ? {
          platform: (versionRow.platform as 'ios' | 'android' | 'all') || 'all',
          minimumVersion: versionRow.minimumVersion,
          latestVersion: versionRow.latestVersion,
          forceUpdate: versionRow.forceUpdate,
          updateUrl: versionRow.updateUrl,
          releaseNotes: versionRow.releaseNotes,
        }
      : DEFAULT_APP_VERSION;

    // 6. Active Announcements
    const announcementRows = await db
      .select()
      .from(mobileAnnouncements)
      .where(eq(mobileAnnouncements.isActive, true));
    const announcements = announcementRows.map((a) => ({
      id: a.id,
      title: a.title,
      message: a.message,
      type: (a.type as 'info' | 'warning' | 'critical' | 'promo') || 'info',
      actionUrl: a.actionUrl,
      actionLabel: a.actionLabel,
      isActive: a.isActive,
      startsAt: a.startsAt?.toISOString() ?? null,
      expiresAt: a.expiresAt?.toISOString() ?? null,
    }));

    return {
      app,
      features,
      featureFlags,
      navigation,
      homeSections,
      version,
      announcements,
    };
    } catch (error) {
      this.logger.warn(
        `Failed to fetch remote mobile config from database; falling back to default bootstrap config: ${error instanceof Error ? error.message : String(error)}`,
      );
      const features: Record<string, boolean> = {};
      for (const flag of DEFAULT_FEATURE_FLAGS) {
        features[flag.key] = flag.enabled;
      }
      return {
        app: DEFAULT_APP_CONFIG,
        features,
        featureFlags: DEFAULT_FEATURE_FLAGS,
        navigation: DEFAULT_NAVIGATION_ITEMS,
        homeSections: DEFAULT_HOME_SECTIONS,
        version: DEFAULT_APP_VERSION,
        announcements: [],
      };
    }
  }
}
