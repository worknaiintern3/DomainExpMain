import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { DatabaseService } from '../database/database.service';
import { NotificationsRepository } from './notifications.repository';
import { PushSenderService } from './push-sender.service';

export interface ExpiryCheckOptions {
  simulatedThresholds?: number[] | undefined;
  dryRun?: boolean | undefined;
  workspaceId?: string | undefined;
  targetUserId?: string | undefined;
}

export interface ExpiryCheckResult {
  jobId: string;
  startedAt: string;
  completedAt: string;
  assetsChecked: number;
  remindersIdentified: number;
  remindersSent: number;
  remindersSkippedAlreadySent: number;
  remindersSkippedDisabled: number;
  dryRun: boolean;
  errors: string[];
}

interface AssetToMonitor {
  assetId: string;
  assetType: 'domain' | 'server' | 'hosting' | 'ssl';
  assetName: string;
  hostname?: string | null;
  expiresAt: Date;
  workspaceId: string;
  ownerUserId?: string | null;
  status: 'active' | 'cancelled' | 'expired';
}

@Injectable()
export class ExpiryMonitorService {
  private readonly logger = new Logger(ExpiryMonitorService.name);
  private readonly LOCK_ID = 'cron_expiry_reminder_job';
  private readonly LOCK_TTL_MS = 15 * 60 * 1000; // 15 minutes

  constructor(
    private readonly database: DatabaseService,
    private readonly repository: NotificationsRepository,
    private readonly pushSender: PushSenderService,
  ) {}

  /**
   * Daily scheduled cron job at 9:00 AM Asia/Kolkata (03:30 UTC).
   * Asia/Kolkata is UTC+5:30, so 09:00 AM IST is 03:30 AM UTC.
   */
  @Cron('30 3 * * *', {
    name: 'daily-expiry-reminder-check',
    timeZone: 'Asia/Kolkata',
  })
  async handleScheduledCron(): Promise<void> {
    this.logger.log('Executing daily 9:00 AM IST asset expiry reminder check...');
    const workerId = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;

    const acquired = await this.repository.acquireSchedulerLock(
      this.LOCK_ID,
      this.LOCK_TTL_MS,
      workerId,
    );

    if (!acquired) {
      this.logger.log(
        'Scheduler lock already held by another cluster instance. Skipping cron execution.',
      );
      return;
    }

    try {
      const result = await this.runExpiryCheck();
      this.logger.log(
        `Daily expiry check finished. Checked: ${result.assetsChecked}, Sent: ${result.remindersSent}, Skipped: ${result.remindersSkippedAlreadySent}`,
      );
    } catch (err: any) {
      this.logger.error(`Error during scheduled expiry check: ${err?.message || String(err)}`);
    } finally {
      await this.repository.releaseSchedulerLock(this.LOCK_ID, workerId);
    }
  }

  /**
   * Core expiry monitoring logic.
   * Can also be triggered on demand or in test simulation mode.
   */
  async runExpiryCheck(options: ExpiryCheckOptions = {}): Promise<ExpiryCheckResult> {
    const startedAt = new Date();
    const jobId = randomUUID();
    const errors: string[] = [];
    let remindersIdentified = 0;
    let remindersSent = 0;
    let remindersSkippedAlreadySent = 0;
    let remindersSkippedDisabled = 0;

    const assets = await this.gatherMonitoredAssets(options.workspaceId);

    for (const asset of assets) {
      try {
        if (asset.status !== 'active') {
          continue;
        }

        // Determine days remaining until expiry in Asia/Kolkata date frame
        const daysRemaining = this.calculateDaysRemaining(asset.expiresAt);

        // Check if current daysRemaining matches standard or simulated thresholds
        const shouldTrigger = options.simulatedThresholds
          ? options.simulatedThresholds.includes(daysRemaining)
          : [15, 7, 3, 1, 0].includes(daysRemaining);

        if (!shouldTrigger && !options.simulatedThresholds) {
          continue;
        }

        // Effective threshold to record in history
        const effectiveThreshold = options.simulatedThresholds
          ? daysRemaining
          : daysRemaining;

        // Resolve target user(s) for this asset
        const targetUserIds = await this.resolveTargetUserIds(asset, options.targetUserId);

        for (const userId of targetUserIds) {
          const preferences = await this.repository.getPreferences(userId);

          if (!preferences.enabled) {
            remindersSkippedDisabled++;
            continue;
          }

          // Check asset type enabled preference
          if (
            (asset.assetType === 'domain' && !preferences.domainsEnabled) ||
            (asset.assetType === 'server' && !preferences.serversEnabled) ||
            (asset.assetType === 'hosting' && !preferences.hostingEnabled) ||
            (asset.assetType === 'ssl' && !preferences.sslEnabled)
          ) {
            remindersSkippedDisabled++;
            continue;
          }

          // Check if user has this threshold enabled in their settings
          const userThresholds = preferences.reminderThresholds ?? [15, 7, 3, 1, 0];
          if (!options.simulatedThresholds && !userThresholds.includes(effectiveThreshold)) {
            remindersSkippedDisabled++;
            continue;
          }

          remindersIdentified++;

          // Check idempotency: has this reminder already been sent for this cycle?
          const alreadySent = await this.repository.hasNotificationBeenSent(
            asset.assetId,
            asset.expiresAt,
            effectiveThreshold,
            userId,
          );

          if (alreadySent) {
            remindersSkippedAlreadySent++;
            continue;
          }

          const { title, body, route } = this.formatExpiryMessage(
            asset.assetType,
            asset.assetName,
            effectiveThreshold,
            asset.assetId,
          );

          if (options.dryRun) {
            remindersSent++;
            continue;
          }

          // Fetch active registered device tokens for the user
          const deviceTokens = await this.repository.getActiveDeviceTokensForUser(userId);

          if (deviceTokens.length === 0) {
            // Record pending notification in history so user can see it in web/app inbox
            await this.repository.recordNotificationHistory({
              userId,
              assetId: asset.assetId,
              assetType: asset.assetType,
              assetName: asset.assetName,
              expiryDate: asset.expiresAt,
              reminderThreshold: effectiveThreshold,
              title,
              body,
              status: 'pending',
              failureReason: 'No registered active mobile device tokens',
            });
            continue;
          }

          // Send push notifications to all active user devices
          const tokens = deviceTokens.map((d) => d.token);
          const pushResult = await this.pushSender.sendPushNotifications([
            {
              to: tokens,
              title,
              body,
              data: {
                assetId: asset.assetId,
                assetType: asset.assetType,
                assetName: asset.assetName,
                route,
              },
              channelId: 'expiry-alerts',
              priority: 'high',
            },
          ]);

          const firstTicket = pushResult.tickets[0];
          const ticketId = firstTicket?.ticketId ?? null;
          const status = pushResult.successfulCount > 0 ? 'sent' : 'failed';
          const failureReason = firstTicket?.error ?? null;

          // Record notification history (unique compound index enforces idempotency)
          try {
            await this.repository.recordNotificationHistory({
              userId,
              assetId: asset.assetId,
              assetType: asset.assetType,
              assetName: asset.assetName,
              expiryDate: asset.expiresAt,
              reminderThreshold: effectiveThreshold,
              title,
              body,
              status,
              ticketId,
              failureReason,
            });
            remindersSent++;
          } catch (insertErr: any) {
            if (insertErr.code === 11000) {
              // Concurrently inserted by another process
              this.logger.warn(`Idempotency duplicate caught for asset ${asset.assetName} threshold ${effectiveThreshold}`);
              remindersSkippedAlreadySent++;
            } else {
              throw insertErr;
            }
          }
        }
      } catch (err: any) {
        const errorMsg = `Error evaluating asset ${asset.assetName} (${asset.assetId}): ${err?.message || String(err)}`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const completedAt = new Date();

    return {
      jobId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      assetsChecked: assets.length,
      remindersIdentified,
      remindersSent,
      remindersSkippedAlreadySent,
      remindersSkippedDisabled,
      dryRun: !!options.dryRun,
      errors,
    };
  }

  /**
   * Aggregates assets from MongoDB:
   * - domains
   * - servers
   * - domainTlsMetadata (SSL)
   * - assetExpiries (custom/managed)
   */
  private async gatherMonitoredAssets(workspaceId?: string): Promise<AssetToMonitor[]> {
    const assets: AssetToMonitor[] = [];
    const query: Record<string, any> = {};
    if (workspaceId) {
      query.workspaceId = workspaceId;
    }

    // 1. Domains
    const domainDocs = await this.database.collections.domains
      .find({
        ...query,
        inventoryState: 'TRACKED',
        expiresAt: { $ne: null },
      })
      .toArray();

    for (const d of domainDocs) {
      if (d.expiresAt) {
        assets.push({
          assetId: d.id,
          assetType: 'domain',
          assetName: d.domainName,
          hostname: d.domainName,
          expiresAt: new Date(d.expiresAt),
          workspaceId: d.workspaceId,
          status: 'active',
        });
      }
    }

    // 2. Servers
    const serverDocs = await this.database.collections.servers
      .find({
        ...query,
        inventoryState: 'TRACKED',
        expiresAt: { $ne: null },
      })
      .toArray();

    for (const s of serverDocs) {
      if (s.expiresAt) {
        assets.push({
          assetId: s.id,
          assetType: 'server',
          assetName: s.name,
          hostname: s.hostname ?? null,
          expiresAt: new Date(s.expiresAt),
          workspaceId: s.workspaceId,
          status: 'active',
        });
      }
    }

    // 3. Domain TLS / SSL
    const tlsDocs = await this.database.collections.domainTlsMetadata
      .find({
        ...query,
        validTo: { $ne: null },
      })
      .toArray();

    // Map domain ID to domain name
    const domainIds = tlsDocs.map((t) => t.domainId).filter(Boolean);
    const domainMap = new Map<string, string>();
    if (domainIds.length > 0) {
      const relatedDomains = await this.database.collections.domains
        .find({ id: { $in: domainIds } }, { projection: { id: 1, domainName: 1 } })
        .toArray();
      for (const rd of relatedDomains) {
        domainMap.set(rd.id, rd.domainName);
      }
    }

    for (const t of tlsDocs) {
      if (t.validTo) {
        const dName = domainMap.get(t.domainId) || 'Domain';
        assets.push({
          assetId: `ssl_${t.domainId}`,
          assetType: 'ssl',
          assetName: `${dName} SSL Certificate`,
          hostname: dName,
          expiresAt: new Date(t.validTo),
          workspaceId: t.workspaceId,
          status: 'active',
        });
      }
    }

    // 4. Custom / Managed Asset Expiries
    const customExpiries = await this.database.collections.assetExpiries
      .find({
        ...query,
        status: 'active',
        expiresAt: { $exists: true },
      })
      .toArray();

    for (const c of customExpiries) {
      assets.push({
        assetId: c.id,
        assetType: c.assetType as any,
        assetName: c.assetName,
        hostname: c.hostname ?? null,
        expiresAt: new Date(c.expiresAt),
        workspaceId: c.workspaceId,
        ownerUserId: c.ownerUserId,
        status: c.status as any,
      });
    }

    return assets;
  }

  /**
   * Resolves target user IDs authorized to receive alerts for this asset.
   */
  private async resolveTargetUserIds(
    asset: AssetToMonitor,
    overrideUserId?: string,
  ): Promise<string[]> {
    if (overrideUserId) {
      return [overrideUserId];
    }

    if (asset.ownerUserId) {
      return [asset.ownerUserId];
    }

    // Look up workspace members
    const members = await this.database.collections.workspaceMembers
      .find({ workspaceId: asset.workspaceId }, { projection: { userId: 1 } })
      .toArray();

    if (members.length > 0) {
      return members.map((m) => m.userId);
    }

    // Fallback: check if personalWorkspaceId on users matches
    const users = await this.database.collections.users
      .find({ personalWorkspaceId: asset.workspaceId }, { projection: { id: 1 } })
      .toArray();

    return users.map((u) => u.id);
  }

  /**
   * Calculates difference in integer days between expiry date and now in Asia/Kolkata timezone.
   */
  private calculateDaysRemaining(expiryDate: Date): number {
    const now = new Date();
    // Offset for Asia/Kolkata (+5:30)
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + IST_OFFSET_MS);
    const expiryIST = new Date(expiryDate.getTime() + IST_OFFSET_MS);

    // Normalize to midnight IST
    const startOfTodayIST = Date.UTC(
      nowIST.getUTCFullYear(),
      nowIST.getUTCMonth(),
      nowIST.getUTCDate(),
    );
    const startOfExpiryIST = Date.UTC(
      expiryIST.getUTCFullYear(),
      expiryIST.getUTCMonth(),
      expiryIST.getUTCDate(),
    );

    const diffMs = startOfExpiryIST - startOfTodayIST;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Formats user-friendly titles, body messages, and mobile deep link routes.
   */
  private formatExpiryMessage(
    assetType: 'domain' | 'server' | 'hosting' | 'ssl',
    assetName: string,
    thresholdDays: number,
    assetId: string,
  ): { title: string; body: string; route: string } {
    let typeLabel = 'Asset';
    let route = `/alerts`;

    if (assetType === 'domain') {
      typeLabel = 'Domain';
      route = `/domain/${assetId}`;
    } else if (assetType === 'server') {
      typeLabel = 'Server';
      route = `/server/${assetId}`;
    } else if (assetType === 'hosting') {
      typeLabel = 'Hosting Plan';
      route = `/hosting`;
    } else if (assetType === 'ssl') {
      typeLabel = 'SSL Certificate';
      const cleanId = assetId.replace(/^ssl_/, '');
      route = `/domain/${cleanId}`;
    }

    if (thresholdDays <= 0) {
      return {
        title: `${typeLabel} Expired Today`,
        body: `Your ${typeLabel.toLowerCase()} "${assetName}" expires today. Take immediate action to avoid service disruption.`,
        route,
      };
    }

    const dayText = thresholdDays === 1 ? '1 day' : `${thresholdDays} days`;
    return {
      title: `${typeLabel} Expiring Soon`,
      body: `Your ${typeLabel.toLowerCase()} "${assetName}" expires in ${dayText}. Review your renewal status.`,
      route,
    };
  }
}
