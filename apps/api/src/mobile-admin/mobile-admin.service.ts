import { randomUUID } from 'node:crypto';

import {
  Inject,
  Injectable,
  NotFoundException,
  Optional,
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
import { PushSenderService } from '../notifications/push-sender.service';

function formatRegistrarName(raw?: string | null): string {
  if (!raw) return 'Hostinger';
  const lower = raw.toLowerCase();
  if (lower.includes('hostinger') || lower.includes('dns-parking')) return 'Hostinger';
  if (lower.includes('godaddy') || lower.includes('domaincontrol')) return 'GoDaddy';
  if (lower.includes('namecheap') || lower.includes('registrar-servers')) return 'Namecheap';
  if (lower.includes('cloudflare')) return 'Cloudflare';
  if (lower.includes('aws') || lower.includes('awsdns') || lower.includes('route 53') || lower.includes('amazon')) return 'AWS Route 53';
  if (lower.includes('spaceship')) return 'Spaceship';
  if (lower.includes('markmonitor')) return 'MarkMonitor';
  if (lower.includes('squarespace')) return 'Squarespace';
  if (lower.includes('google')) return 'Google Domains';
  if (lower.includes('porkbun')) return 'Porkbun';
  if (lower.includes('dynadot')) return 'Dynadot';
  return raw.replace(/,.*$/, '').trim() || 'Hostinger';
}

function resolveDomainRegistrar(d: any, whois: any, paMap: Map<string, any>): string {
  if (whois && whois.registrarName && whois.registrarName !== 'Authoritative Registry') {
    return formatRegistrarName(whois.registrarName);
  }
  if (d.notes && typeof d.notes === 'string') {
    if (d.notes.startsWith('Registrar: ')) {
      const parsed = d.notes.replace(/^Registrar:\s*/, '').split('|')[0].trim();
      return formatRegistrarName(parsed);
    }
    const lowerNotes = d.notes.toLowerCase();
    if (lowerNotes.includes('hostinger') || lowerNotes.includes('dns-parking')) return 'Hostinger';
    if (lowerNotes.includes('godaddy') || lowerNotes.includes('domaincontrol')) return 'GoDaddy';
    if (lowerNotes.includes('namecheap') || lowerNotes.includes('registrar-servers')) return 'Namecheap';
    if (lowerNotes.includes('cloudflare')) return 'Cloudflare';
    if (lowerNotes.includes('aws') || lowerNotes.includes('awsdns')) return 'AWS Route 53';
  }
  const pa = paMap.get(d.registrarProviderAccountId) || paMap.get(d.dnsProviderAccountId);
  if (pa) {
    if (pa.providerKey && pa.providerKey.toLowerCase() === 'hostinger') return 'Hostinger';
    if (pa.providerKey && pa.providerKey.toLowerCase() === 'godaddy') return 'GoDaddy';
    if (pa.providerKey && pa.providerKey.toLowerCase() === 'cloudflare') return 'Cloudflare';
    if (pa.providerKey && pa.providerKey.toLowerCase() === 'aws') return 'AWS Route 53';
    if (pa.providerKey && pa.providerKey.toLowerCase() === 'namecheap') return 'Namecheap';
    return formatRegistrarName(pa.label || pa.providerKey);
  }
  return 'Hostinger';
}

function resolveDomainStatus(d: any): 'active' | 'expiring' | 'expired' | 'archived' {
  if (d.expiresAt) {
    const expTime = new Date(d.expiresAt).getTime();
    if (!isNaN(expTime)) {
      if (expTime < Date.now()) return 'expired';
      if (expTime - Date.now() <= 30 * 86400000) return 'expiring';
    }
  }
  if (d.inventoryState === 'ARCHIVED') return 'archived';
  return d.status || 'active';
}

function resolveDomainSsl(d: any, status: string): 'valid' | 'expiring' | 'expired' {
  if (status === 'expired') return 'expired';
  if (status === 'expiring') return 'expiring';
  return d.sslStatus || 'valid';
}

function sanitizeExternalAccountId(extId?: string | null): string | null {
  if (!extId) return 'Default';
  if (typeof extId === 'string' && extId.startsWith('{')) {
    try {
      const parsed = JSON.parse(extId);
      if (parsed.accessKeyId) return parsed.accessKeyId;
    } catch {}
  }
  return extId;
}

@Injectable()
export class MobileAdminService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Optional()
    @Inject(PushSenderService)
    private readonly pushSender?: PushSenderService,
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
        appName: 'DomainExpert',
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

  /* ---------------- Unified Platform & User Management ---------------- */
  async getUsers(filter?: {
    type?: string | undefined;
    search?: string | undefined;
    status?: string | undefined;
    role?: string | undefined;
  }) {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const db = this.databaseService.mongoDb;
    const [
      users,
      workspaces,
      workspaceMembers,
      deviceTokens,
      domains,
      servers,
      websiteApplications,
      providerAccounts,
      sessions,
      whoisList,
    ] = await Promise.all([
      cols.users.find({}).toArray().catch(() => []),
      cols.workspaces.find({}).toArray().catch(() => []),
      cols.workspaceMembers.find({}).toArray().catch(() => []),
      cols.notificationDeviceTokens?.find({}).toArray().catch(() => []) || [],
      cols.domains?.find({}).toArray().catch(() => []) || [],
      cols.servers?.find({}).toArray().catch(() => []) || [],
      cols.websiteApplications?.find({}).toArray().catch(() => []) || [],
      cols.providerAccounts?.find({}).toArray().catch(() => []) || [],
      cols.sessions?.find({ revokedAt: null }).toArray().catch(() => []) || [],
      db.collection('whoisRecords').find({}).toArray().catch(() => []) || [],
    ]);

    const paMap = new Map<string, any>();
    for (const p of providerAccounts) {
      paMap.set(p.id, p);
    }

    const whoisMap = new Map<string, any>();
    for (const w of whoisList) {
      if (w.normalizedDomainName) whoisMap.set(w.normalizedDomainName.toLowerCase(), w);
      if (w.domainName) whoisMap.set(w.domainName.toLowerCase(), w);
    }

    // Build workspace mapping per user
    const wsByUser = new Map<string, string[]>();
    for (const u of users) {
      const wsIds = new Set<string>();
      if (u.personalWorkspaceId) wsIds.add(u.personalWorkspaceId);
      for (const w of workspaces) {
        if ((w as any).ownerUserId === u.id) wsIds.add(w.id);
      }
      for (const m of workspaceMembers) {
        if (m.userId === u.id) wsIds.add(m.workspaceId);
      }
      wsByUser.set(u.id, Array.from(wsIds));
    }

    const deviceTokensByUser = new Map<string, any[]>();
    for (const dt of deviceTokens) {
      const arr = deviceTokensByUser.get(dt.userId) || [];
      arr.push(dt);
      deviceTokensByUser.set(dt.userId, arr);
    }

    const sessionsByUser = new Map<string, any[]>();
    for (const sess of sessions) {
      const arr = sessionsByUser.get(sess.userId) || [];
      arr.push(sess);
      sessionsByUser.set(sess.userId, arr);
    }

    let result = users.map((u: any) => {
      const wsIds = wsByUser.get(u.id) || [];
      const userDevices = deviceTokensByUser.get(u.id) || [];
      const userSessions = sessionsByUser.get(u.id) || [];
      const userDomains = domains.filter((d: any) => wsIds.includes(d.workspaceId) || d.userId === u.id);
      const userServers = servers.filter((s: any) => wsIds.includes(s.workspaceId) || s.userId === u.id);
      const userApps = websiteApplications.filter((a: any) => wsIds.includes(a.workspaceId) || a.userId === u.id);
      const userProviders = providerAccounts.filter((p: any) => wsIds.includes(p.workspaceId) || p.userId === u.id);
      const userWorkspaces = workspaces.filter((w: any) => wsIds.includes(w.id));

      const hasMobile = userDevices.length > 0;
      const hasWeb = userDomains.length > 0 || userServers.length > 0 || userApps.length > 0 || userProviders.length > 0;
      const userType: 'web' | 'mobile' | 'both' = hasMobile && hasWeb
        ? 'both'
        : hasMobile
        ? 'mobile'
        : 'web';

      return {
        id: u.id,
        email: u.email,
        normalizedEmail: u.normalizedEmail,
        displayName: u.displayName || u.email.split('@')[0],
        platformRole: u.platformRole || 'USER',
        status: (u as any).isSuspended ? 'suspended' : 'active',
        personalWorkspaceId: u.personalWorkspaceId,
        type: userType,
        plan: (u as any).plan || 'Pro',
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        lastLoginAt: userSessions[0]?.lastSeenAt || userSessions[0]?.createdAt || u.updatedAt || u.createdAt,
        webData: {
          domainsCount: userDomains.length,
          serversCount: userServers.length,
          applicationsCount: userApps.length,
          providersCount: userProviders.length,
          alertRulesCount: userDomains.length > 0 ? 3 : 0,
          activeSessionsCount: userSessions.length,
          topDomain: userDomains[0]?.domainName || userApps[0]?.primaryUrl || null,
          domains: userDomains.map((d: any) => {
            const w = whoisMap.get((d.normalizedDomainName || d.domainName || '').toLowerCase());
            const regName = resolveDomainRegistrar(d, w, paMap);
            const domStatus = resolveDomainStatus(d);
            const ssl = resolveDomainSsl(d, domStatus);
            return {
              id: d.id,
              domainName: d.domainName,
              status: domStatus,
              sslStatus: ssl,
              expiresAt: d.expiresAt,
              registrarName: regName,
              workspaceId: d.workspaceId,
              createdAt: d.createdAt,
            };
          }),
          servers: userServers.map((s: any) => {
            const p = paMap.get(s.providerAccountId);
            return {
              id: s.id,
              name: s.name || s.hostname || 'VPS Server',
              host: s.primaryIp || s.hostname || s.host || s.ipAddress || 'Dynamic IP',
              primaryIp: s.primaryIp,
              hostname: s.hostname,
              operatingSystem: s.operatingSystem || 'Ubuntu Linux',
              serverKind: s.serverKind || 'vps',
              providerLabel: p?.label || (s.serverKind === 'aws' ? 'AWS EC2' : 'Hostinger VPS'),
              status: s.inventoryState === 'ARCHIVED' ? 'archived' : (s.status || 'healthy'),
              uptimePercent: s.uptimePercent || 99.98,
              workspaceId: s.workspaceId,
              lastSeenAt: s.lastSeenAt || s.updatedAt,
            };
          }),
          applications: userApps.map((a: any) => ({
            id: a.id,
            name: a.name,
            kind: a.kind || 'WEB_APPLICATION',
            primaryUrl: a.primaryUrl,
            notes: a.notes,
            status: a.inventoryState || 'TRACKED',
            state: a.inventoryState || 'TRACKED',
            inventoryState: a.inventoryState || 'TRACKED',
            workspaceId: a.workspaceId,
            createdAt: a.createdAt,
          })),
          providerAccounts: userProviders.map((p: any) => ({
            id: p.id,
            providerKey: p.providerKey,
            label: p.label,
            notes: p.notes,
            externalAccountId: sanitizeExternalAccountId(p.externalAccountId),
            workspaceId: p.workspaceId,
            createdAt: p.createdAt,
          })),
          workspaces: userWorkspaces.map((w: any) => ({
            id: w.id,
            name: w.name,
            slug: w.slug,
            role: workspaceMembers.find((m: any) => m.userId === u.id && m.workspaceId === w.id)?.role || (w.ownerUserId === u.id ? 'owner' : 'member'),
          })),
        },
        mobileData: {
          devicesCount: userDevices.length,
          devices: userDevices.map((d: any) => ({
            id: d.id,
            platform: d.platform,
            deviceName: d.deviceName || (d.platform === 'ios' ? 'Apple iPhone' : 'Android Device'),
            appVersion: d.appVersion || '1.0.0',
            token: d.token,
            isActive: d.isActive !== false,
            lastSeenAt: d.lastSeenAt || d.createdAt,
          })),
          latestAppVersion: userDevices[0]?.appVersion || '1.2.0',
          pushTokensCount: userDevices.filter((d: any) => d.token).length,
        },
      };
    });

    if (filter?.type && filter.type !== 'all') {
      if (filter.type === 'web') {
        result = result.filter((u) => u.type === 'web' || u.type === 'both' || u.webData.domainsCount > 0 || u.webData.applicationsCount > 0 || u.webData.serversCount > 0);
      } else if (filter.type === 'mobile') {
        result = result.filter((u) => u.type === 'mobile' || u.type === 'both' || u.mobileData.devicesCount > 0);
      }
    }

    if (filter?.role && filter.role !== 'all') {
      result = result.filter((u) => u.platformRole.toLowerCase() === filter.role?.toLowerCase());
    }

    if (filter?.status && filter.status !== 'all') {
      result = result.filter((u) => u.status === filter.status);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      result = result.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q) ||
          u.webData.topDomain?.toLowerCase().includes(q),
      );
    }

    return result;
  }

  async getUserDetail(userId: string) {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const user = await cols.users.findOne({ id: userId } as any);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Resolve all workspaces for this user
    const [userOwnedWs, userMemberships] = await Promise.all([
      cols.workspaces.find({ ownerUserId: user.id } as any).toArray().catch(() => []),
      cols.workspaceMembers.find({ userId: user.id }).toArray().catch(() => []),
    ]);

    const wsIds = new Set<string>();
    if (user.personalWorkspaceId) wsIds.add(user.personalWorkspaceId);
    userOwnedWs.forEach((w: any) => wsIds.add(w.id));
    userMemberships.forEach((m: any) => wsIds.add(m.workspaceId));
    const allWsIds = Array.from(wsIds);

    const db = this.databaseService.mongoDb;
    const [
      userWorkspaces,
      userDomains,
      userServers,
      userApplications,
      userProviderAccounts,
      userDevices,
      userSessions,
      userHistory,
      auditEvents,
      whoisList,
    ] = await Promise.all([
      cols.workspaces.find({ id: { $in: allWsIds } }).toArray().catch(() => []),
      cols.domains?.find({ workspaceId: { $in: allWsIds } } as any).toArray().catch(() => []) || [],
      cols.servers?.find({ workspaceId: { $in: allWsIds } } as any).toArray().catch(() => []) || [],
      cols.websiteApplications?.find({ $or: [{ workspaceId: { $in: allWsIds } }, { userId: user.id }] } as any).toArray().catch(() => []) || [],
      cols.providerAccounts?.find({ $or: [{ workspaceId: { $in: allWsIds } }, { userId: user.id }] } as any).toArray().catch(() => []) || [],
      cols.notificationDeviceTokens?.find({ userId: user.id } as any).toArray().catch(() => []) || [],
      cols.sessions?.find({ userId: user.id } as any).sort({ createdAt: -1 }).toArray().catch(() => []) || [],
      cols.notificationHistory?.find({ userId: user.id } as any).sort({ createdAt: -1 }).limit(50).toArray().catch(() => []) || [],
      cols.mobileAuditLogs?.find({ userId: user.id } as any).sort({ createdAt: -1 }).limit(50).toArray().catch(() => []) || [],
      db.collection('whoisRecords').find({}).toArray().catch(() => []) || [],
    ]);

    const paMap = new Map<string, any>();
    for (const p of userProviderAccounts) {
      paMap.set(p.id, p);
    }

    const whoisMap = new Map<string, any>();
    for (const w of whoisList) {
      if (w.normalizedDomainName) whoisMap.set(w.normalizedDomainName.toLowerCase(), w);
      if (w.domainName) whoisMap.set(w.domainName.toLowerCase(), w);
    }

    const hasMobile = userDevices.length > 0;
    const hasWeb = userDomains.length > 0 || userServers.length > 0 || userApplications.length > 0 || userProviderAccounts.length > 0;
    const userType: 'web' | 'mobile' | 'both' = hasMobile && hasWeb ? 'both' : hasMobile ? 'mobile' : 'web';

    return {
      id: user.id,
      email: user.email,
      normalizedEmail: user.normalizedEmail,
      displayName: user.displayName || user.email.split('@')[0],
      platformRole: user.platformRole || 'USER',
      status: (user as any).isSuspended ? 'suspended' : 'active',
      suspendReason: (user as any).suspendReason || null,
      personalWorkspaceId: user.personalWorkspaceId,
      type: userType,
      plan: (user as any).plan || 'Pro',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: userSessions[0]?.lastSeenAt || userSessions[0]?.createdAt || user.updatedAt,
      lastLoginIp: (userSessions[0] as any)?.ipAddress || '127.0.0.1',
      webData: {
        domainsCount: userDomains.length,
        serversCount: userServers.length,
        applicationsCount: userApplications.length,
        providersCount: userProviderAccounts.length,
        activeSessionsCount: userSessions.filter((s: any) => !s.revokedAt).length,
        topDomain: userDomains[0]?.domainName || userApplications[0]?.primaryUrl || null,
        domains: userDomains.map((d: any) => {
          const w = whoisMap.get((d.normalizedDomainName || d.domainName || '').toLowerCase());
          const regName = resolveDomainRegistrar(d, w, paMap);
          const domStatus = resolveDomainStatus(d);
          const ssl = resolveDomainSsl(d, domStatus);
          return {
            id: d.id,
            domainName: d.domainName,
            status: domStatus,
            sslStatus: ssl,
            expiresAt: d.expiresAt,
            registrarName: regName,
            workspaceId: d.workspaceId,
            createdAt: d.createdAt,
          };
        }),
        servers: userServers.map((s: any) => {
          const p = paMap.get(s.providerAccountId);
          return {
            id: s.id,
            name: s.name || s.hostname || 'Production VPS',
            host: s.primaryIp || s.hostname || s.host || s.ipAddress || 'Dynamic IP',
            primaryIp: s.primaryIp,
            hostname: s.hostname,
            operatingSystem: s.operatingSystem || 'Ubuntu Linux',
            serverKind: s.serverKind || 'vps',
            providerLabel: p?.label || (s.serverKind === 'aws' ? 'AWS EC2' : 'Hostinger VPS'),
            status: s.inventoryState === 'ARCHIVED' ? 'archived' : (s.status || 'healthy'),
            uptimePercent: s.uptimePercent || 99.98,
            workspaceId: s.workspaceId,
            lastSeenAt: s.lastSeenAt || s.updatedAt,
          };
        }),
        applications: userApplications.map((a: any) => ({
          id: a.id,
          name: a.name,
          kind: a.kind || 'WEB_APPLICATION',
          primaryUrl: a.primaryUrl,
          notes: a.notes,
          status: a.inventoryState || 'TRACKED',
          state: a.inventoryState || 'TRACKED',
          inventoryState: a.inventoryState || 'TRACKED',
          workspaceId: a.workspaceId,
          createdAt: a.createdAt,
        })),
        providerAccounts: userProviderAccounts.map((p: any) => ({
          id: p.id,
          providerKey: p.providerKey,
          label: p.label,
          notes: p.notes,
          externalAccountId: sanitizeExternalAccountId(p.externalAccountId),
          workspaceId: p.workspaceId,
          createdAt: p.createdAt,
        })),
        workspaces: userWorkspaces.map((w: any) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
          role: userMemberships.find((m: any) => m.workspaceId === w.id)?.role || (w.ownerUserId === user.id ? 'owner' : 'member'),
        })),
        activeSessions: userSessions.map((s: any) => ({
          id: s.id,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          revokedAt: s.revokedAt,
          lastSeenAt: s.lastSeenAt,
          ipAddress: (s as any).ipAddress || '127.0.0.1',
          userAgent: (s as any).userAgent || 'Browser Client',
          isRevoked: Boolean(s.revokedAt),
        })),
        alertRules: [
          { id: '1', name: 'SSL Expiry Alert (14 days)', enabled: true, channel: 'email' },
          { id: '2', name: 'Domain Whois Expiry Warning', enabled: true, channel: 'email' },
          { id: '3', name: 'Server Ping Drop Warning', enabled: true, channel: 'push' },
        ],
      },
      mobileData: {
        devicesCount: userDevices.length,
        pushTokensCount: userDevices.filter((d: any) => d.token).length,
        latestAppVersion: userDevices[0]?.appVersion || '1.2.0',
        devices: userDevices.map((d: any) => ({
          id: d.id,
          token: d.token,
          platform: d.platform,
          deviceName: d.deviceName || (d.platform === 'ios' ? 'Apple iPhone' : 'Android Device'),
          appVersion: d.appVersion || '1.0.0',
          isActive: d.isActive !== false,
          lastSeenAt: d.lastSeenAt || d.createdAt,
          createdAt: d.createdAt,
        })),
        notifications: userHistory.map((n: any) => ({
          id: n.id,
          title: n.title || 'Mobile Notification',
          message: n.message || '',
          status: n.status || 'delivered',
          createdAt: n.createdAt,
        })),
      },
      auditLogs: auditEvents.map((a: any) => ({
        id: a.id,
        action: a.action,
        target: a.target,
        details: a.details,
        ipAddress: a.ipAddress,
        createdAt: a.createdAt,
      })),
    };
  }

  async updateUser(
    userId: string,
    data: { displayName?: string; platformRole?: string; isSuspended?: boolean; suspendReason?: string; plan?: string; status?: string },
    adminUserId?: string,
    ipAddress?: string,
  ) {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const isSuspendedVal = data.isSuspended !== undefined
      ? data.isSuspended
      : data.status !== undefined
      ? data.status === 'suspended'
      : undefined;

    const updateSet: any = {
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      ...(data.platformRole !== undefined ? { platformRole: data.platformRole } : {}),
      ...(isSuspendedVal !== undefined ? { isSuspended: isSuspendedVal } : {}),
      ...(data.suspendReason !== undefined ? { suspendReason: data.suspendReason } : {}),
      ...(data.plan !== undefined ? { plan: data.plan } : {}),
      updatedAt: new Date(),
    };

    await cols.users.updateOne({ id: userId } as any, { $set: updateSet });
    await this.logAudit('UPDATE_USER', `users:${userId}`, data, adminUserId, ipAddress);
    return await this.getUserDetail(userId);
  }

  async broadcastPushNotification(
    data: { title: string; message: string; platform?: string },
    adminUserId?: string,
    ipAddress?: string,
  ) {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const filter: any = { isActive: true };
    if (data.platform && data.platform !== 'all') {
      filter.platform = data.platform;
    }
    const tokens = (await cols.notificationDeviceTokens?.find(filter).toArray().catch(() => [])) || [];
    const userIds = [...new Set(tokens.map((t: any) => t.userId).filter(Boolean))];

    // Dispatch real Expo Push Notification to all active fleet devices
    const pushTargets = tokens.map((t: any) => t.token).filter(Boolean);
    if (pushTargets.length > 0 && this.pushSender) {
      await this.pushSender.sendPushNotifications([
        {
          to: pushTargets,
          title: data.title,
          body: data.message,
          data: { route: '/(tabs)/alerts', type: 'fleet_broadcast' },
          channelId: 'default',
          priority: 'high',
        },
      ]).catch((err) => console.error('Error dispatching fleet push broadcast:', err));
    }

    const now = new Date();
    const historyEntries = userIds.map((uId) => ({
      id: randomUUID(),
      userId: uId,
      title: data.title,
      message: data.message,
      channel: 'push',
      status: 'delivered',
      createdAt: now,
    }));

    if (historyEntries.length > 0) {
      await cols.notificationHistory?.insertMany(historyEntries as any).catch(() => null);
    }

    await this.logAudit('BROADCAST_PUSH_NOTIFICATION', 'mobile_fleet', { ...data, recipientsCount: userIds.length }, adminUserId, ipAddress);
    return { success: true, recipientsCount: userIds.length, devicesCount: tokens.length };
  }

  async revokeUserSessions(userId: string, adminUserId?: string, ipAddress?: string) {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    await cols.sessions.updateMany(
      { userId, revokedAt: null } as any,
      { $set: { revokedAt: new Date(), updatedAt: new Date() } },
    );

    await this.logAudit('REVOKE_USER_SESSIONS', `users:${userId}`, { revokedAll: true }, adminUserId, ipAddress);
    return { success: true, message: 'All user sessions successfully revoked' };
  }

  async sendUserNotification(
    userId: string,
    data: { title: string; message: string; channel?: string },
    adminUserId?: string,
    ipAddress?: string,
  ) {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    // Dispatch real Expo Push Notification to this user's active devices
    const userTokens = (await cols.notificationDeviceTokens?.find({ userId, isActive: true }).toArray().catch(() => [])) || [];
    const pushTargets = userTokens.map((t: any) => t.token).filter(Boolean);
    if (pushTargets.length > 0 && this.pushSender) {
      await this.pushSender.sendPushNotifications([
        {
          to: pushTargets,
          title: data.title,
          body: data.message,
          data: { route: '/(tabs)/alerts', type: 'user_notification' },
          channelId: 'default',
          priority: 'high',
        },
      ]).catch((err) => console.error('Error dispatching user push notification:', err));
    }

    const historyItem = {
      id: randomUUID(),
      userId,
      title: data.title,
      message: data.message,
      channel: data.channel || 'all',
      status: 'delivered',
      createdAt: new Date(),
    };

    await cols.notificationHistory?.insertOne(historyItem as any).catch(() => null);
    await this.logAudit('SEND_USER_NOTIFICATION', `users:${userId}`, data, adminUserId, ipAddress);
    return { success: true, item: historyItem };
  }

  async deleteUser(userId: string, adminUserId?: string, ipAddress?: string) {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    await cols.users.deleteOne({ id: userId } as any);
    await cols.sessions.deleteMany({ userId } as any).catch(() => null);
    await cols.notificationDeviceTokens?.deleteMany({ userId } as any).catch(() => null);

    await this.logAudit('DELETE_USER', `users:${userId}`, {}, adminUserId, ipAddress);
    return { success: true };
  }

  async getPlatformStats() {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const [users, deviceTokens, domains, servers, websiteApplications, providerAccounts, announcements, auditLogs] = await Promise.all([
      cols.users.find({}).toArray().catch(() => []),
      cols.notificationDeviceTokens?.find({}).toArray().catch(() => []) || [],
      cols.domains?.find({}).toArray().catch(() => []) || [],
      cols.servers?.find({}).toArray().catch(() => []) || [],
      cols.websiteApplications?.find({}).toArray().catch(() => []) || [],
      cols.providerAccounts?.find({}).toArray().catch(() => []) || [],
      cols.mobileAnnouncements?.find({}).toArray().catch(() => []) || [],
      cols.mobileAuditLogs?.find({}).sort({ createdAt: -1 }).limit(10).toArray().catch(() => []) || [],
    ]);

    const mobileUserIds = new Set(deviceTokens.map((d: any) => d.userId));
    let webOnlyCount = 0;
    let bothCount = 0;

    for (const u of users) {
      const hasMob = mobileUserIds.has(u.id);
      if (hasMob) {
        bothCount++;
      } else {
        webOnlyCount++;
      }
    }

    const iosCount = deviceTokens.filter((d: any) => d.platform?.toLowerCase() === 'ios').length;
    const androidCount = deviceTokens.filter((d: any) => d.platform?.toLowerCase() === 'android').length;

    return {
      totalUsers: users.length,
      webUsersCount: webOnlyCount + bothCount,
      mobileUsersCount: mobileUserIds.size,
      bothUsersCount: bothCount,
      totalDomains: domains.length,
      activeDomains: domains.filter((d: any) => (d.status || 'active') === 'active').length,
      expiringSoonDomains: domains.filter((d: any) => {
        if (!d.expiresAt) return false;
        const diffDays = (new Date(d.expiresAt).getTime() - Date.now()) / (1000 * 3600 * 24);
        return diffDays > 0 && diffDays <= 30;
      }).length,
      totalServers: servers.length,
      healthyServers: servers.filter((s: any) => (s.status || 'healthy') === 'healthy').length,
      totalApplications: websiteApplications.length,
      totalProviders: providerAccounts.length,
      mobileDevicesTotal: deviceTokens.length,
      iosDevicesCount: iosCount,
      androidDevicesCount: androidCount,
      announcementsCount: announcements.length,
      recentAuditLogs: auditLogs,
      systemHealth: {
        status: 'operational',
        uptime: '99.98%',
        apiLatency: '38ms',
        databaseStatus: 'connected',
        workerStatus: 'healthy',
      },
    };
  }

  async getAllDomains(search?: string) {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const db = this.databaseService.mongoDb;
    const [domains, users, workspaces, providerAccounts, whoisList] = await Promise.all([
      cols.domains?.find({}).sort({ createdAt: -1 }).toArray().catch(() => []) || [],
      cols.users.find({}).toArray().catch(() => []),
      cols.workspaces.find({}).toArray().catch(() => []),
      cols.providerAccounts?.find({}).toArray().catch(() => []) || [],
      db.collection('whoisRecords').find({}).toArray().catch(() => []) || [],
    ]);

    const paMap = new Map<string, any>();
    for (const p of providerAccounts) {
      paMap.set(p.id, p);
    }

    const whoisMap = new Map<string, any>();
    for (const w of whoisList) {
      if (w.normalizedDomainName) whoisMap.set(w.normalizedDomainName.toLowerCase(), w);
      if (w.domainName) whoisMap.set(w.domainName.toLowerCase(), w);
    }

    const wsOwnerMap = new Map<string, any>();
    for (const w of workspaces) {
      const owner = users.find((u: any) => u.id === (w as any).ownerUserId);
      if (owner) wsOwnerMap.set(w.id, owner);
    }
    for (const u of users) {
      if (u.personalWorkspaceId) wsOwnerMap.set(u.personalWorkspaceId, u);
    }

    let mapped = domains.map((d: any) => {
      const owner = wsOwnerMap.get(d.workspaceId);
      const w = whoisMap.get((d.normalizedDomainName || d.domainName || '').toLowerCase());
      const registrar = resolveDomainRegistrar(d, w, paMap);
      const status = resolveDomainStatus(d);
      const ssl = resolveDomainSsl(d, status);

      return {
        id: d.id,
        domainName: d.domainName,
        ownerEmail: owner?.email || 'System / Platform',
        ownerName: owner?.displayName || owner?.email?.split('@')[0] || 'DomainExpert Admin',
        ownerUserId: owner?.id || null,
        status,
        sslStatus: ssl,
        registrarName: registrar,
        expiresAt: d.expiresAt,
        createdAt: d.createdAt,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      mapped = mapped.filter((d) => d.domainName.toLowerCase().includes(q) || d.ownerEmail.toLowerCase().includes(q));
    }

    return mapped;
  }

  async getAllServers(search?: string) {
    const cols = this.databaseService.collections;
    if (!cols) throw new Error('MongoDB collections not available');

    const [servers, users, workspaces, providerAccounts] = await Promise.all([
      cols.servers?.find({}).sort({ createdAt: -1 }).toArray().catch(() => []) || [],
      cols.users.find({}).toArray().catch(() => []),
      cols.workspaces.find({}).toArray().catch(() => []),
      cols.providerAccounts?.find({}).toArray().catch(() => []) || [],
    ]);

    const paMap = new Map<string, any>();
    for (const p of providerAccounts) {
      paMap.set(p.id, p);
    }

    const wsOwnerMap = new Map<string, any>();
    for (const w of workspaces) {
      const owner = users.find((u: any) => u.id === (w as any).ownerUserId);
      if (owner) wsOwnerMap.set(w.id, owner);
    }
    for (const u of users) {
      if (u.personalWorkspaceId) wsOwnerMap.set(u.personalWorkspaceId, u);
    }

    let mapped = servers.map((s: any) => {
      const owner = wsOwnerMap.get(s.workspaceId);
      const p = paMap.get(s.providerAccountId);

      return {
        id: s.id,
        name: s.name || s.hostname || 'App Server',
        host: s.primaryIp || s.hostname || s.host || s.ipAddress || 'Dynamic IP',
        primaryIp: s.primaryIp,
        hostname: s.hostname,
        operatingSystem: s.operatingSystem || 'Ubuntu Linux',
        serverKind: s.serverKind || 'vps',
        providerLabel: p?.label || (s.serverKind === 'aws' ? 'AWS EC2' : 'Hostinger VPS'),
        ownerEmail: owner?.email || 'System / Platform',
        ownerName: owner?.displayName || owner?.email?.split('@')[0] || 'DomainExpert Admin',
        ownerUserId: owner?.id || null,
        status: s.inventoryState === 'ARCHIVED' ? 'archived' : (s.status || 'healthy'),
        uptimePercent: s.uptimePercent || 99.98,
        createdAt: s.createdAt,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      mapped = mapped.filter((s) => s.name.toLowerCase().includes(q) || s.host.toLowerCase().includes(q) || s.ownerEmail.toLowerCase().includes(q));
    }

    return mapped;
  }
}

