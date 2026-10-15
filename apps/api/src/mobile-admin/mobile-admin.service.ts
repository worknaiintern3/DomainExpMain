import { randomUUID } from 'node:crypto';

import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  MobileAnnouncementTable,
  MobileAppConfigTable,
  MobileAppVersionTable,
  MobileAuditLogTable,
  MobileFeatureFlagTable,
  MobileHomeConfigTable,
  MobileNavigationConfigTable,
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
    const cols = this.databaseService.collections;
    if (!cols) return;
    await cols.mobileAuditLogs.insertOne({
      id: randomUUID(),
      action,
      target,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      userId: userId ?? null,
      ipAddress: ipAddress ?? null,
      createdAt: new Date(),
    } as any);
  }

  /* ---------------- App Config ---------------- */
  async getAppConfig(): Promise<MobileAppConfigTable> {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const row = await cols.mobileAppConfig.findOne({});
    if (!row) {
      const inserted: MobileAppConfigTable = {
        id: randomUUID(),
        appName: 'DomainPulse',
        logoUrl: null,
        primaryColor: '#2563EB',
        secondaryColor: '#1E293B',
        maintenanceMode: false,
        maintenanceMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await cols.mobileAppConfig.insertOne(inserted as any);
      return inserted;
    }
    return row;
  }

  async updateAppConfig(
    input: UpdateMobileAppConfigRequest,
    userId?: string | null,
    ipAddress?: string | null,
  ): Promise<MobileAppConfigTable> {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const current = await this.getAppConfig();
    const updateSet: Partial<MobileAppConfigTable> = {
      ...(input.appName !== undefined ? { appName: input.appName } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
      ...(input.secondaryColor !== undefined ? { secondaryColor: input.secondaryColor } : {}),
      ...(input.maintenanceMode !== undefined ? { maintenanceMode: input.maintenanceMode } : {}),
      ...(input.maintenanceMessage !== undefined ? { maintenanceMessage: input.maintenanceMessage } : {}),
      updatedAt: new Date(),
    };

    await cols.mobileAppConfig.updateOne({ id: current.id }, { $set: updateSet });
    const updated = await cols.mobileAppConfig.findOne({ id: current.id });
    if (!updated) {
      throw new NotFoundException('Mobile app config not found');
    }

    await this.logAudit('UPDATE_APP_CONFIG', 'mobile_app_config', input, userId, ipAddress);
    return updated;
  }

  /* ---------------- Feature Flags ---------------- */
  async getFeatureFlags(): Promise<MobileFeatureFlagTable[]> {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const rows = await cols.mobileFeatureFlags.find({}).toArray();
    if (rows.length === 0) {
      const now = new Date();
      const defaults = [
        { id: randomUUID(), key: 'domains', name: 'Domains', description: 'Domain portfolio', enabled: true, minAppVersion: null, createdAt: now, updatedAt: now },
        { id: randomUUID(), key: 'servers', name: 'Servers', description: 'VPS & infrastructure', enabled: true, minAppVersion: null, createdAt: now, updatedAt: now },
        { id: randomUUID(), key: 'websites', name: 'Websites', description: 'Web applications', enabled: true, minAppVersion: null, createdAt: now, updatedAt: now },
        { id: randomUUID(), key: 'alerts', name: 'Alerts', description: 'Expiration alerts', enabled: true, minAppVersion: null, createdAt: now, updatedAt: now },
        { id: randomUUID(), key: 'providers', name: 'Providers', description: 'Connected accounts', enabled: true, minAppVersion: null, createdAt: now, updatedAt: now },
        { id: randomUUID(), key: 'infrastructureMap', name: 'Infrastructure Map', description: 'Visual map', enabled: true, minAppVersion: null, createdAt: now, updatedAt: now },
        { id: randomUUID(), key: 'aiDomainFinder', name: 'AI Domain Finder', description: 'Domain search and AI generator', enabled: true, minAppVersion: null, createdAt: now, updatedAt: now },
      ];
      await cols.mobileFeatureFlags.insertMany(defaults as any);
      return defaults;
    }
    return rows;
  }

  async updateFeatureFlag(
    key: string,
    input: UpdateMobileFeatureFlagRequest,
    userId?: string | null,
    ipAddress?: string | null,
  ): Promise<MobileFeatureFlagTable> {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    await this.getFeatureFlags(); // Ensure defaults exist
    const updateSet: any = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.minAppVersion !== undefined ? { minAppVersion: input.minAppVersion } : {}),
      updatedAt: new Date(),
    };

    await cols.mobileFeatureFlags.updateOne({ key }, { $set: updateSet });
    const updated = await cols.mobileFeatureFlags.findOne({ key });
    if (!updated) {
      throw new NotFoundException(`Feature flag '${key}' not found`);
    }

    await this.logAudit('UPDATE_FEATURE_FLAG', `mobile_feature_flags:${key}`, input, userId, ipAddress);
    return updated;
  }

  /* ---------------- Navigation ---------------- */
  async getNavigation(): Promise<MobileNavigationConfigTable[]> {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const rows = await cols.mobileNavigationConfig.find({}).sort({ sortOrder: 1 }).toArray();
    if (rows.length === 0) {
      const now = new Date();
      const defaults = [
        { id: randomUUID(), key: 'home', label: 'Home', icon: 'home', route: '/home', sortOrder: 1, enabled: true, badge: null, createdAt: now, updatedAt: now },
        { id: randomUUID(), key: 'domains', label: 'Domains', icon: 'globe', route: '/domains', sortOrder: 2, enabled: true, badge: null, createdAt: now, updatedAt: now },
        { id: randomUUID(), key: 'servers', label: 'Servers', icon: 'server', route: '/servers', sortOrder: 3, enabled: true, badge: null, createdAt: now, updatedAt: now },
        { id: randomUUID(), key: 'alerts', label: 'Alerts', icon: 'bell', route: '/alerts', sortOrder: 4, enabled: true, badge: null, createdAt: now, updatedAt: now },
        { id: randomUUID(), key: 'settings', label: 'Settings', icon: 'settings', route: '/settings', sortOrder: 5, enabled: true, badge: null, createdAt: now, updatedAt: now },
      ];
      await cols.mobileNavigationConfig.insertMany(defaults as any);
      return defaults;
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
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const now = new Date();
    for (const item of items) {
      await cols.mobileNavigationConfig.updateOne(
        { key: item.key },
        {
          $set: {
            label: item.label,
            icon: item.icon,
            route: item.route,
            sortOrder: item.sortOrder,
            enabled: item.enabled,
            badge: item.badge ?? null,
            updatedAt: now,
          },
          $setOnInsert: {
            id: randomUUID(),
            createdAt: now,
          },
        },
        { upsert: true },
      );
    }

    await this.logAudit('UPDATE_NAVIGATION', 'mobile_navigation_config', items, userId, ipAddress);
    return this.getNavigation();
  }

  /* ---------------- Home Layout ---------------- */
  async getHomeConfig(): Promise<MobileHomeConfigTable[]> {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const rows = await cols.mobileHomeConfig.find({}).sort({ sortOrder: 1 }).toArray();
    if (rows.length === 0) {
      const now = new Date();
      const defaults = [
        { id: randomUUID(), sectionKey: 'banner', title: 'Announcements', sortOrder: 1, enabled: true, configJson: null, createdAt: now, updatedAt: now },
        { id: randomUUID(), sectionKey: 'stats', title: 'Overview Metrics', sortOrder: 2, enabled: true, configJson: null, createdAt: now, updatedAt: now },
        { id: randomUUID(), sectionKey: 'quickActions', title: 'Quick Actions', sortOrder: 3, enabled: true, configJson: null, createdAt: now, updatedAt: now },
        { id: randomUUID(), sectionKey: 'alerts', title: 'Urgent Alerts', sortOrder: 4, enabled: true, configJson: null, createdAt: now, updatedAt: now },
        { id: randomUUID(), sectionKey: 'domains', title: 'Expiring Domains', sortOrder: 5, enabled: true, configJson: null, createdAt: now, updatedAt: now },
        { id: randomUUID(), sectionKey: 'servers', title: 'Monitored Infrastructure', sortOrder: 6, enabled: true, configJson: null, createdAt: now, updatedAt: now },
      ];
      await cols.mobileHomeConfig.insertMany(defaults as any);
      return defaults;
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
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const now = new Date();
    for (const section of sections) {
      await cols.mobileHomeConfig.updateOne(
        { sectionKey: section.sectionKey },
        {
          $set: {
            title: section.title,
            sortOrder: section.sortOrder,
            enabled: section.enabled,
            configJson: section.configJson ?? null,
            updatedAt: now,
          },
          $setOnInsert: {
            id: randomUUID(),
            createdAt: now,
          },
        },
        { upsert: true },
      );
    }

    await this.logAudit('UPDATE_HOME_CONFIG', 'mobile_home_config', sections, userId, ipAddress);
    return this.getHomeConfig();
  }

  /* ---------------- Versions ---------------- */
  async getVersions(): Promise<MobileAppVersionTable[]> {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const rows = await cols.mobileAppVersions.find({}).toArray();
    if (rows.length === 0) {
      const now = new Date();
      const defaults = [
        {
          id: randomUUID(),
          platform: 'all',
          minimumVersion: '1.0.0',
          latestVersion: '1.0.0',
          forceUpdate: false,
          updateUrl: null,
          releaseNotes: 'Initial release',
          createdAt: now,
          updatedAt: now,
        },
      ];
      await cols.mobileAppVersions.insertMany(defaults as any);
      return defaults;
    }
    return rows;
  }

  async updateVersion(
    platform: string,
    input: UpdateMobileAppVersionRequest,
    userId?: string | null,
    ipAddress?: string | null,
  ): Promise<MobileAppVersionTable> {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    await this.getVersions(); // Ensure defaults exist
    const updateSet: any = {
      ...(input.minimumVersion !== undefined ? { minimumVersion: input.minimumVersion } : {}),
      ...(input.latestVersion !== undefined ? { latestVersion: input.latestVersion } : {}),
      ...(input.forceUpdate !== undefined ? { forceUpdate: input.forceUpdate } : {}),
      ...(input.updateUrl !== undefined ? { updateUrl: input.updateUrl } : {}),
      ...(input.releaseNotes !== undefined ? { releaseNotes: input.releaseNotes } : {}),
      updatedAt: new Date(),
    };

    await cols.mobileAppVersions.updateOne({ platform }, { $set: updateSet });
    const updated = await cols.mobileAppVersions.findOne({ platform });
    if (!updated) {
      throw new NotFoundException(`Version policy for platform '${platform}' not found`);
    }

    await this.logAudit('UPDATE_APP_VERSION', `mobile_app_versions:${platform}`, input, userId, ipAddress);
    return updated;
  }

  /* ---------------- Announcements ---------------- */
  async getAnnouncements(): Promise<MobileAnnouncementTable[]> {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    return await cols.mobileAnnouncements.find({}).sort({ createdAt: -1 }).toArray();
  }

  async createAnnouncement(
    input: CreateMobileAnnouncementRequest,
    userId?: string | null,
    ipAddress?: string | null,
  ): Promise<MobileAnnouncementTable> {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const created: MobileAnnouncementTable = {
      id: randomUUID(),
      title: input.title,
      message: input.message,
      type: input.type ?? 'info',
      actionUrl: input.actionUrl ?? null,
      actionLabel: input.actionLabel ?? null,
      isActive: input.isActive ?? true,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await cols.mobileAnnouncements.insertOne(created as any);
    await this.logAudit('CREATE_ANNOUNCEMENT', `mobile_announcements:${created.id}`, input, userId, ipAddress);
    return created;
  }

  async updateAnnouncement(
    id: string,
    input: UpdateMobileAnnouncementRequest,
    userId?: string | null,
    ipAddress?: string | null,
  ): Promise<MobileAnnouncementTable> {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const updateSet: any = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.message !== undefined ? { message: input.message } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.actionUrl !== undefined ? { actionUrl: input.actionUrl } : {}),
      ...(input.actionLabel !== undefined ? { actionLabel: input.actionLabel } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt ? new Date(input.startsAt) : null } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
      updatedAt: new Date(),
    };

    await cols.mobileAnnouncements.updateOne({ id }, { $set: updateSet });
    const updated = await cols.mobileAnnouncements.findOne({ id });
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
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const res = await cols.mobileAnnouncements.deleteOne({ id });
    if ((res.deletedCount ?? 0) === 0) {
      throw new NotFoundException(`Announcement '${id}' not found`);
    }

    await this.logAudit('DELETE_ANNOUNCEMENT', `mobile_announcements:${id}`, {}, userId, ipAddress);
  }

  /* ---------------- Audit Logs ---------------- */
  async getAuditLogs(): Promise<MobileAuditLogTable[]> {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    return await cols.mobileAuditLogs.find({}).sort({ createdAt: -1 }).limit(100).toArray();
  }
}
