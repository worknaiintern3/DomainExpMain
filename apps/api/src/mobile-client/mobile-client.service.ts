import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { MobileBootstrapConfigResponse } from '@domainpulse/contracts';

import { DatabaseService } from '../database/database.service';
import { AccessTokenService } from '../auth/access-token';
import { generateRefreshToken, hashRefreshToken } from '../auth/crypto';

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
  releaseNotes: 'Initial release',
};

@Injectable()
export class MobileClientService {
  private readonly logger = new Logger(MobileClientService.name);

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AccessTokenService)
    private readonly accessTokenService: AccessTokenService,
  ) {}

  async getBootstrapConfig(): Promise<MobileBootstrapConfigResponse> {
    try {
      const cols = this.databaseService.collections;
      const configRow = await cols?.mobileAppConfig.findOne({});
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

      const flagRows = (await cols?.mobileFeatureFlags.find({}).toArray()) || [];
      const featureFlags =
        flagRows.length > 0
          ? flagRows.map((f: any) => ({
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

      const navRows =
        (await cols?.mobileNavigationConfig
          .find({})
          .sort({ sortOrder: 1 })
          .toArray()) || [];
      const navigation =
        navRows.length > 0
          ? navRows.map((n: any) => ({
              key: n.key,
              label: n.label,
              icon: n.icon,
              route: n.route,
              sortOrder: n.sortOrder,
              enabled: n.enabled,
              badge: n.badge,
            }))
          : DEFAULT_NAVIGATION_ITEMS;

      const homeRows =
        (await cols?.mobileHomeConfig
          .find({})
          .sort({ sortOrder: 1 })
          .toArray()) || [];
      const homeSections =
        homeRows.length > 0
          ? homeRows.map((h: any) => ({
              sectionKey: h.sectionKey,
              title: h.title,
              sortOrder: h.sortOrder,
              enabled: h.enabled,
              configJson: (h.configJson as Record<string, unknown> | null) ?? null,
            }))
          : DEFAULT_HOME_SECTIONS;

      const versionRow = await cols?.mobileAppVersions.findOne({});
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

      const announcementRows =
        (await cols?.mobileAnnouncements
          .find({ isActive: true } as any)
          .toArray()) || [];
      const announcements = announcementRows.map((a: any) => ({
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

  async getOrCreateMobileSession(requestedEmail?: string): Promise<{
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    session: { id: string; userId: string; expiresAt: string };
    user: { id: string; email: string; displayName: string | null };
    workspaceId: string;
  }> {
    const normalized = (requestedEmail || 'vrd@gmail.com').trim().toLowerCase();
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const userRow = await cols.users.findOne({ normalizedEmail: normalized });
    if (!userRow) {
      throw new NotFoundException(`User account not found for email: ${requestedEmail || normalized}`);
    }

    const membership = await cols.workspaceMembers.findOne({ userId: userRow.id });
    const workspaceId = membership?.workspaceId ?? userRow.personalWorkspaceId;

    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const sessionId = randomUUID();

    await cols.sessions.insertOne({
      id: sessionId,
      userId: userRow.id,
      refreshTokenHash,
      expiresAt,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const issuedToken = this.accessTokenService.issue({
      sessionId,
      userId: userRow.id,
    });

    return {
      accessToken: issuedToken.token,
      accessTokenExpiresAt: issuedToken.expiresAt.toISOString(),
      refreshToken,
      session: {
        id: sessionId,
        userId: userRow.id,
        expiresAt: expiresAt.toISOString(),
      },
      user: {
        id: userRow.id,
        email: userRow.email,
        displayName: userRow.displayName ?? null,
      },
      workspaceId,
    };
  }
}
