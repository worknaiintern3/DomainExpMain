import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';
import {
  mobileAnnouncements,
  mobileAppConfig,
  mobileAppVersions,
  mobileAuditLogs,
  mobileFeatureFlags,
  mobileHomeConfig,
  mobileNavigationConfig,
  type MobileAnnouncementTable,
  type MobileAppConfigTable,
  type MobileAppVersionTable,
  type MobileAuditLogTable,
  type MobileFeatureFlagTable,
  type MobileHomeConfigTable,
  type MobileNavigationConfigTable,
} from '@domainpulse/database';
import type {
  CreateMobileAnnouncementRequest,
  UpdateMobileAnnouncementRequest,
  UpdateMobileAppConfigRequest,
  UpdateMobileAppVersionRequest,
  UpdateMobileFeatureFlagRequest,
} from '@domainpulse/contracts';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class MobileAdminService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  private async logAudit(
    action: string,
    target: string,
    details: unknown,
    userId?: string | null,
    ipAddress?: string | null,
  ): Promise<void> {
    const db = this.databaseService.database;
    await db.insert(mobileAuditLogs).values({
      action,
      target,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      userId: userId ?? null,
      ipAddress: ipAddress ?? null,
    });
  }

  /* ---------------- App Config ---------------- */
  async getAppConfig(): Promise<MobileAppConfigTable> {
    const db = this.databaseService.database;
    const [row] = await db.select().from(mobileAppConfig).limit(1);
    if (!row) {
      const [inserted] = await db
        .insert(mobileAppConfig)
        .values({
          appName: 'DomainPulse',
          logoUrl: null,
          primaryColor: '#2563EB',
          secondaryColor: '#1E293B',
          maintenanceMode: false,
          maintenanceMessage: null,
        })
        .returning();
      if (!inserted) {
        throw new Error('Failed to create default mobile app config');
      }
      return inserted;
    }
    return row;
  }

  async updateAppConfig(
    input: UpdateMobileAppConfigRequest,
    userId?: string | null,
    ipAddress?: string | null,
  ): Promise<MobileAppConfigTable> {
    const db = this.databaseService.database;
    const current = await this.getAppConfig();

    const [updated] = await db
      .update(mobileAppConfig)
      .set({
        ...(input.appName !== undefined ? { appName: input.appName } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
        ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
        ...(input.secondaryColor !== undefined ? { secondaryColor: input.secondaryColor } : {}),
        ...(input.maintenanceMode !== undefined ? { maintenanceMode: input.maintenanceMode } : {}),
        ...(input.maintenanceMessage !== undefined ? { maintenanceMessage: input.maintenanceMessage } : {}),
        updatedAt: new Date(),
      })
      .where(eq(mobileAppConfig.id, current.id))
      .returning();

    if (!updated) {
      throw new NotFoundException('Mobile app config not found');
    }

    await this.logAudit('UPDATE_APP_CONFIG', 'mobile_app_config', input, userId, ipAddress);
    return updated;
  }

  /* ---------------- Feature Flags ---------------- */
  async getFeatureFlags(): Promise<MobileFeatureFlagTable[]> {
    const db = this.databaseService.database;
    const rows = await db.select().from(mobileFeatureFlags);
    if (rows.length === 0) {
      const defaults = [
        { key: 'domains', name: 'Domains', description: 'Domain portfolio', enabled: true },
        { key: 'servers', name: 'Servers', description: 'VPS & infrastructure', enabled: true },
        { key: 'websites', name: 'Websites', description: 'Web applications', enabled: true },
        { key: 'alerts', name: 'Alerts', description: 'Expiration alerts', enabled: true },
        { key: 'providers', name: 'Providers', description: 'Connected accounts', enabled: true },
        { key: 'infrastructureMap', name: 'Infrastructure Map', description: 'Visual map', enabled: true },
        { key: 'aiDomainFinder', name: 'AI Domain Finder', description: 'Domain search and AI generator', enabled: true },
      ];
      return await db.insert(mobileFeatureFlags).values(defaults).returning();
    }
    return rows;
  }

  async updateFeatureFlag(
    key: string,
    input: UpdateMobileFeatureFlagRequest,
    userId?: string | null,
    ipAddress?: string | null,
  ): Promise<MobileFeatureFlagTable> {
    const db = this.databaseService.database;
    await this.getFeatureFlags(); // Ensure defaults exist

    const [updated] = await db
      .update(mobileFeatureFlags)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.minAppVersion !== undefined ? { minAppVersion: input.minAppVersion } : {}),
        updatedAt: new Date(),
      })
      .where(eq(mobileFeatureFlags.key, key))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Feature flag '${key}' not found`);
    }

    await this.logAudit('UPDATE_FEATURE_FLAG', `mobile_feature_flags:${key}`, input, userId, ipAddress);
    return updated;
  }

  /* ---------------- Navigation ---------------- */
  async getNavigation(): Promise<MobileNavigationConfigTable[]> {
    const db = this.databaseService.database;
    const rows = await db
      .select()
      .from(mobileNavigationConfig)
      .orderBy(asc(mobileNavigationConfig.sortOrder));

    if (rows.length === 0) {
      const defaults = [
        { key: 'home', label: 'Home', icon: 'home', route: '/home', sortOrder: 1, enabled: true },
        { key: 'domains', label: 'Domains', icon: 'globe', route: '/domains', sortOrder: 2, enabled: true },
        { key: 'servers', label: 'Servers', icon: 'server', route: '/servers', sortOrder: 3, enabled: true },
        { key: 'alerts', label: 'Alerts', icon: 'bell', route: '/alerts', sortOrder: 4, enabled: true },
        { key: 'settings', label: 'Settings', icon: 'settings', route: '/settings', sortOrder: 5, enabled: true },
      ];
      return await db.insert(mobileNavigationConfig).values(defaults).returning();
    }
    return rows;
  }

  async updateNavigation(
    items: Array<{
      key: string;
      label: string;
      icon: string;
      route: string;
      sortOrder: number;
      enabled: boolean;
      badge?: string | null | undefined;
    }>,
    userId?: string | null,
    ipAddress?: string | null,
  ): Promise<MobileNavigationConfigTable[]> {
    const db = this.databaseService.database;
    for (const item of items) {
      await db
        .insert(mobileNavigationConfig)
        .values({
          key: item.key,
          label: item.label,
          icon: item.icon,
          route: item.route,
          sortOrder: item.sortOrder,
          enabled: item.enabled,
          badge: item.badge ?? null,
        })
        .onConflictDoUpdate({
          target: mobileNavigationConfig.key,
          set: {
            label: item.label,
            icon: item.icon,
            route: item.route,
            sortOrder: item.sortOrder,
            enabled: item.enabled,
            badge: item.badge ?? null,
            updatedAt: new Date(),
          },
        });
    }

    await this.logAudit('UPDATE_NAVIGATION', 'mobile_navigation_config', items, userId, ipAddress);
    return this.getNavigation();
  }

  /* ---------------- Home Layout ---------------- */
  async getHomeConfig(): Promise<MobileHomeConfigTable[]> {
    const db = this.databaseService.database;
    const rows = await db
      .select()
      .from(mobileHomeConfig)
      .orderBy(asc(mobileHomeConfig.sortOrder));

    if (rows.length === 0) {
      const defaults = [
        { sectionKey: 'banner', title: 'Announcements', sortOrder: 1, enabled: true },
        { sectionKey: 'stats', title: 'Overview Metrics', sortOrder: 2, enabled: true },
        { sectionKey: 'quickActions', title: 'Quick Actions', sortOrder: 3, enabled: true },
        { sectionKey: 'alerts', title: 'Urgent Alerts', sortOrder: 4, enabled: true },
        { sectionKey: 'domains', title: 'Expiring Domains', sortOrder: 5, enabled: true },
        { sectionKey: 'servers', title: 'Monitored Infrastructure', sortOrder: 6, enabled: true },
      ];
      return await db.insert(mobileHomeConfig).values(defaults).returning();
    }
    return rows;
  }

  async updateHomeConfig(
    sections: Array<{
      sectionKey: string;
      title: string;
      sortOrder: number;
      enabled: boolean;
      configJson?: Record<string, unknown> | null | undefined;
    }>,
    userId?: string | null,
    ipAddress?: string | null,
  ): Promise<MobileHomeConfigTable[]> {
    const db = this.databaseService.database;
    for (const section of sections) {
      await db
        .insert(mobileHomeConfig)
        .values({
          sectionKey: section.sectionKey,
          title: section.title,
          sortOrder: section.sortOrder,
          enabled: section.enabled,
          configJson: section.configJson ?? null,
        })
        .onConflictDoUpdate({
          target: mobileHomeConfig.sectionKey,
          set: {
            title: section.title,
            sortOrder: section.sortOrder,
            enabled: section.enabled,
            configJson: section.configJson ?? null,
            updatedAt: new Date(),
          },
        });
    }

    await this.logAudit('UPDATE_HOME_CONFIG', 'mobile_home_config', sections, userId, ipAddress);
    return this.getHomeConfig();
  }

  /* ---------------- Versions ---------------- */
  async getVersions(): Promise<MobileAppVersionTable[]> {
    const db = this.databaseService.database;
    const rows = await db.select().from(mobileAppVersions);
    if (rows.length === 0) {
      const defaults = [
        {
          platform: 'all',
          minimumVersion: '1.0.0',
          latestVersion: '1.0.0',
          forceUpdate: false,
          updateUrl: null,
          releaseNotes: 'Initial release',
        },
      ];
      return await db.insert(mobileAppVersions).values(defaults).returning();
    }
    return rows;
  }

  async updateVersion(
    platform: string,
    input: UpdateMobileAppVersionRequest,
    userId?: string | null,
    ipAddress?: string | null,
  ): Promise<MobileAppVersionTable> {
    const db = this.databaseService.database;
    await this.getVersions(); // Ensure defaults exist

    const [updated] = await db
      .update(mobileAppVersions)
      .set({
        ...(input.minimumVersion !== undefined ? { minimumVersion: input.minimumVersion } : {}),
        ...(input.latestVersion !== undefined ? { latestVersion: input.latestVersion } : {}),
        ...(input.forceUpdate !== undefined ? { forceUpdate: input.forceUpdate } : {}),
        ...(input.updateUrl !== undefined ? { updateUrl: input.updateUrl } : {}),
        ...(input.releaseNotes !== undefined ? { releaseNotes: input.releaseNotes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(mobileAppVersions.platform, platform))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Version policy for platform '${platform}' not found`);
    }

    await this.logAudit('UPDATE_APP_VERSION', `mobile_app_versions:${platform}`, input, userId, ipAddress);
    return updated;
  }

  /* ---------------- Announcements ---------------- */
  async getAnnouncements(): Promise<MobileAnnouncementTable[]> {
    const db = this.databaseService.database;
    return await db
      .select()
      .from(mobileAnnouncements)
      .orderBy(desc(mobileAnnouncements.createdAt));
  }

  async createAnnouncement(
    input: CreateMobileAnnouncementRequest,
    userId?: string | null,
    ipAddress?: string | null,
  ): Promise<MobileAnnouncementTable> {
    const db = this.databaseService.database;
    const [created] = await db
      .insert(mobileAnnouncements)
      .values({
        title: input.title,
        message: input.message,
        type: input.type ?? 'info',
        actionUrl: input.actionUrl ?? null,
        actionLabel: input.actionLabel ?? null,
        isActive: input.isActive ?? true,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create mobile announcement');
    }

    await this.logAudit('CREATE_ANNOUNCEMENT', `mobile_announcements:${created.id}`, input, userId, ipAddress);
    return created;
  }

  async updateAnnouncement(
    id: string,
    input: UpdateMobileAnnouncementRequest,
    userId?: string | null,
    ipAddress?: string | null,
  ): Promise<MobileAnnouncementTable> {
    const db = this.databaseService.database;
    const [updated] = await db
      .update(mobileAnnouncements)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.message !== undefined ? { message: input.message } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.actionUrl !== undefined ? { actionUrl: input.actionUrl } : {}),
        ...(input.actionLabel !== undefined ? { actionLabel: input.actionLabel } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt ? new Date(input.startsAt) : null } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(mobileAnnouncements.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Announcement '${id}' not found`);
    }

    await this.logAudit('UPDATE_ANNOUNCEMENT', `mobile_announcements:${id}`, input, userId, ipAddress);
    return updated;
  }

  async deleteAnnouncement(
    id: string,
    userId?: string | null,
    ipAddress?: string | null,
  ): Promise<void> {
    const db = this.databaseService.database;
    const deleted = await db
      .delete(mobileAnnouncements)
      .where(eq(mobileAnnouncements.id, id))
      .returning();

    if (deleted.length === 0) {
      throw new NotFoundException(`Announcement '${id}' not found`);
    }

    await this.logAudit('DELETE_ANNOUNCEMENT', `mobile_announcements:${id}`, {}, userId, ipAddress);
  }

  /* ---------------- Audit Logs ---------------- */
  async getAuditLogs(): Promise<MobileAuditLogTable[]> {
    const db = this.databaseService.database;
    return await db
      .select()
      .from(mobileAuditLogs)
      .orderBy(desc(mobileAuditLogs.createdAt))
      .limit(100);
  }
}
