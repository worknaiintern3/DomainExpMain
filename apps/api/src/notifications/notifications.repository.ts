import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type {
  AssetExpiry,
  NotificationDeviceToken,
  NotificationHistoryItem,
  NotificationPreference,
} from '@domainpulse/database';

import { DatabaseService } from '../database/database.service';

export interface UpsertDeviceTokenParams {
  userId: string;
  token: string;
  platform?: string;
  deviceName?: string | null;
  appVersion?: string | null;
}

export interface RecordNotificationHistoryParams {
  userId: string;
  assetId: string;
  assetType: 'domain' | 'server' | 'hosting' | 'ssl';
  assetName: string;
  expiryDate: Date;
  reminderThreshold: number;
  title: string;
  body: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  ticketId?: string | null;
  receiptId?: string | null;
  failureReason?: string | null;
}

@Injectable()
export class NotificationsRepository {
  private readonly logger = new Logger(NotificationsRepository.name);

  constructor(private readonly database: DatabaseService) {}

  async upsertDeviceToken(params: UpsertDeviceTokenParams): Promise<NotificationDeviceToken> {
    const now = new Date();
    const collection = this.database.collections.notificationDeviceTokens;

    const result = await collection.findOneAndUpdate(
      { token: params.token },
      {
        $set: {
          userId: params.userId,
          platform: params.platform ?? 'unknown',
          deviceName: params.deviceName ?? null,
          appVersion: params.appVersion ?? null,
          isActive: true,
          lastSeenAt: now,
          updatedAt: now,
        },
        $setOnInsert: {
          id: randomUUID(),
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    return result as NotificationDeviceToken;
  }

  async deactivateDeviceToken(token: string, userId?: string): Promise<boolean> {
    const query: Record<string, any> = { token };
    if (userId) {
      query.userId = userId;
    }
    const result = await this.database.collections.notificationDeviceTokens.updateOne(query, {
      $set: { isActive: false, updatedAt: new Date() },
    });
    return result.matchedCount > 0;
  }

  async deactivateDeviceTokens(tokens: string[]): Promise<number> {
    if (!tokens.length) return 0;
    const result = await this.database.collections.notificationDeviceTokens.updateMany(
      { token: { $in: tokens } },
      { $set: { isActive: false, updatedAt: new Date() } },
    );
    return result.modifiedCount;
  }

  async getActiveDeviceTokensForUser(userId: string): Promise<NotificationDeviceToken[]> {
    return this.database.collections.notificationDeviceTokens
      .find({ userId, isActive: true })
      .toArray() as Promise<NotificationDeviceToken[]>;
  }

  async getActiveDeviceTokensForUsers(userIds: string[]): Promise<NotificationDeviceToken[]> {
    if (!userIds.length) return [];
    return this.database.collections.notificationDeviceTokens
      .find({ userId: { $in: userIds }, isActive: true })
      .toArray() as Promise<NotificationDeviceToken[]>;
  }

  async getPreferences(userId: string): Promise<NotificationPreference> {
    const pref = await this.database.collections.notificationPreferences.findOne({ userId });
    if (pref) {
      return pref as NotificationPreference;
    }

    const defaultPref: NotificationPreference = {
      id: randomUUID(),
      userId,
      enabled: true,
      reminderThresholds: [15, 7, 3, 1, 0],
      domainsEnabled: true,
      serversEnabled: true,
      hostingEnabled: true,
      sslEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return defaultPref;
  }

  async upsertPreferences(
    userId: string,
    data: Partial<Omit<NotificationPreference, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<NotificationPreference> {
    const now = new Date();
    const result = await this.database.collections.notificationPreferences.findOneAndUpdate(
      { userId },
      {
        $set: {
          ...data,
          updatedAt: now,
        },
        $setOnInsert: {
          id: randomUUID(),
          userId,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return result as NotificationPreference;
  }

  async getNotificationHistory(userId: string, limit = 50): Promise<NotificationHistoryItem[]> {
    return this.database.collections.notificationHistory
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray() as Promise<NotificationHistoryItem[]>;
  }

  async markNotificationAsRead(id: string, userId: string): Promise<boolean> {
    const result = await this.database.collections.notificationHistory.updateOne(
      { id, userId },
      { $set: { isRead: true, readAt: new Date(), updatedAt: new Date() } },
    );
    return result.matchedCount > 0;
  }

  async recordNotificationHistory(params: RecordNotificationHistoryParams): Promise<NotificationHistoryItem> {
    const now = new Date();
    const item: NotificationHistoryItem = {
      id: randomUUID(),
      userId: params.userId,
      assetId: params.assetId,
      assetType: params.assetType,
      assetName: params.assetName,
      expiryDate: params.expiryDate,
      reminderThreshold: params.reminderThreshold,
      title: params.title,
      body: params.body,
      status: params.status,
      ticketId: params.ticketId ?? null,
      receiptId: params.receiptId ?? null,
      failureReason: params.failureReason ?? null,
      isRead: false,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.database.collections.notificationHistory.insertOne(item as any);
    return item;
  }

  async updateNotificationHistoryTicket(
    id: string,
    ticketId: string,
    status: 'sent' | 'delivered' | 'failed',
    failureReason?: string | null,
  ): Promise<void> {
    await this.database.collections.notificationHistory.updateOne(
      { id },
      {
        $set: {
          ticketId,
          status,
          failureReason: failureReason ?? null,
          updatedAt: new Date(),
        },
      },
    );
  }

  async hasNotificationBeenSent(
    assetId: string,
    expiryDate: Date,
    reminderThreshold: number,
    userId: string,
  ): Promise<boolean> {
    // Normalizing expiryDate to day boundaries or exact match
    const startOfDay = new Date(expiryDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(expiryDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const count = await this.database.collections.notificationHistory.countDocuments({
      assetId,
      userId,
      reminderThreshold,
      expiryDate: { $gte: startOfDay, $lte: endOfDay },
    });

    return count > 0;
  }

  async getAssetExpiries(workspaceId?: string, ownerUserId?: string): Promise<AssetExpiry[]> {
    const query: Record<string, any> = {};
    if (workspaceId) {
      query.workspaceId = workspaceId;
    }
    if (ownerUserId) {
      query.ownerUserId = ownerUserId;
    }
    return this.database.collections.assetExpiries
      .find(query)
      .sort({ expiresAt: 1 })
      .toArray() as Promise<AssetExpiry[]>;
  }

  async upsertAssetExpiry(data: Partial<AssetExpiry> & {
    workspaceId: string;
    ownerUserId: string;
    assetType: 'domain' | 'server' | 'hosting' | 'ssl';
    assetName: string;
    expiresAt: Date;
  }): Promise<AssetExpiry> {
    const now = new Date();
    const { id: dataId, ...fieldsToSet } = data;
    const id = dataId ?? randomUUID();
    const result = await this.database.collections.assetExpiries.findOneAndUpdate(
      { id },
      {
        $set: {
          ...fieldsToSet,
          updatedAt: now,
        },
        $setOnInsert: {
          id,
          createdAt: now,
          status: data.status ?? 'active',
          timeZone: data.timeZone ?? 'Asia/Kolkata',
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return result as AssetExpiry;
  }

  async acquireSchedulerLock(lockId: string, ttlMs: number, lockedBy: string): Promise<boolean> {
    const now = new Date();
    const newLockExpiry = new Date(now.getTime() + ttlMs);

    try {
      const result = await this.database.collections.schedulerLocks.findOneAndUpdate(
        {
          id: lockId,
          $or: [
            { lockedUntil: { $lt: now } },
            { lockedUntil: { $exists: false } },
            { lockedBy },
          ],
        },
        {
          $set: {
            lockedUntil: newLockExpiry,
            lockedBy,
            updatedAt: now,
          },
          $setOnInsert: {
            id: lockId,
          },
        },
        { upsert: true, returnDocument: 'after' },
      );

      return !!result;
    } catch (err: any) {
      if (err.code === 11000) {
        // Duplicate key race condition - lock is held by another worker
        return false;
      }
      this.logger.error(`Error acquiring scheduler lock ${lockId}: ${err.message}`);
      return false;
    }
  }

  async releaseSchedulerLock(lockId: string, lockedBy: string): Promise<void> {
    try {
      await this.database.collections.schedulerLocks.updateOne(
        { id: lockId, lockedBy },
        {
          $set: {
            lockedUntil: new Date(0),
            updatedAt: new Date(),
          },
        },
      );
    } catch (err: any) {
      this.logger.warn(`Failed to cleanly release lock ${lockId}: ${err.message}`);
    }
  }
}
