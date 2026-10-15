import { Injectable, Logger } from '@nestjs/common';
import Expo, {
  type ExpoPushMessage,
  type ExpoPushTicket,
} from 'expo-server-sdk';

import { NotificationsRepository } from './notifications.repository';

export interface SendPushNotificationOptions {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: string;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
}

export interface PushSendResult {
  successfulCount: number;
  failureCount: number;
  tickets: Array<{
    token: string;
    status: 'ok' | 'error';
    ticketId?: string;
    error?: string;
  }>;
}

@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);
  private readonly expo: Expo;

  constructor(private readonly repository: NotificationsRepository) {
    const expoToken = process.env.EXPO_ACCESS_TOKEN;
    this.expo = new Expo(expoToken ? { accessToken: expoToken } : {});
  }

  /**
   * Dispatches push notifications via Expo Push Service.
   * Handles invalid token pruning and batch chunking automatically.
   */
  async sendPushNotifications(
    notifications: SendPushNotificationOptions[],
  ): Promise<PushSendResult> {
    const validMessages: ExpoPushMessage[] = [];
    const invalidTokens: string[] = [];

    for (const item of notifications) {
      const targets = Array.isArray(item.to) ? item.to : [item.to];

      for (const token of targets) {
        if (!Expo.isExpoPushToken(token)) {
          this.logger.warn(`Invalid Expo push token detected: ${token}`);
          invalidTokens.push(token);
          continue;
        }

        const msg: ExpoPushMessage = {
          to: token,
          sound: item.sound ?? 'default',
          title: item.title,
          body: item.body,
          data: item.data ?? {},
          channelId: item.channelId ?? 'expiry-alerts',
          priority: item.priority ?? 'high',
        };

        if (item.badge !== undefined) {
          msg.badge = item.badge;
        }

        validMessages.push(msg);
      }
    }

    // Prune invalid tokens in database
    if (invalidTokens.length > 0) {
      await this.repository.deactivateDeviceTokens(invalidTokens);
    }

    if (validMessages.length === 0) {
      return {
        successfulCount: 0,
        failureCount: invalidTokens.length,
        tickets: invalidTokens.map((t) => ({
          token: t,
          status: 'error',
          error: 'InvalidExpoPushToken',
        })),
      };
    }

    const chunks = this.expo.chunkPushNotifications(validMessages);
    const tickets: Array<{
      token: string;
      status: 'ok' | 'error';
      ticketId?: string;
      error?: string;
    }> = [];

    let successfulCount = 0;
    let failureCount = invalidTokens.length;
    const tokensToDeactivate: string[] = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);

        ticketChunk.forEach((ticket: ExpoPushTicket, index: number) => {
          const chunkItem = chunk[index];
          const targetToken = chunkItem ? String(chunkItem.to) : 'unknown';

          if (ticket.status === 'ok') {
            successfulCount++;
            tickets.push({
              token: targetToken,
              status: 'ok',
              ticketId: ticket.id,
            });
          } else {
            failureCount++;
            const errorDetails = ticket.details?.error;
            const errorMessage = ticket.message || errorDetails || 'Unknown error';

            tickets.push({
              token: targetToken,
              status: 'error',
              error: errorMessage,
            });

            if (errorDetails === 'DeviceNotRegistered') {
              this.logger.log(`Device not registered for token: ${targetToken}. Deactivating.`);
              tokensToDeactivate.push(targetToken);
            } else {
              this.logger.warn(
                `Push notification failed for token (${targetToken}): ${errorMessage}`,
              );
            }
          }
        });
      } catch (err: any) {
        this.logger.error(`Error sending push notification chunk: ${err?.message || String(err)}`);
        for (const msg of chunk) {
          failureCount++;
          tickets.push({
            token: String(msg.to),
            status: 'error',
            error: err?.message || 'NetworkError',
          });
        }
      }
    }

    if (tokensToDeactivate.length > 0) {
      await this.repository.deactivateDeviceTokens(tokensToDeactivate);
    }

    return {
      successfulCount,
      failureCount,
      tickets,
    };
  }

  /**
   * Checks receipts for previously submitted tickets.
   */
  async checkPushReceipts(receiptIds: string[]): Promise<{
    deliveredIds: string[];
    failedIds: Array<{ id: string; error: string }>;
  }> {
    if (!receiptIds.length) {
      return { deliveredIds: [], failedIds: [] };
    }

    const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);
    const deliveredIds: string[] = [];
    const failedIds: Array<{ id: string; error: string }> = [];

    for (const chunk of receiptIdChunks) {
      try {
        const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);

        for (const [receiptId, receipt] of Object.entries(receipts)) {
          if (receipt.status === 'ok') {
            deliveredIds.push(receiptId);
          } else if (receipt.status === 'error') {
            const err = receipt.details?.error || receipt.message || 'UnknownReceiptError';
            failedIds.push({ id: receiptId, error: err });
            this.logger.warn(`Push receipt error for ${receiptId}: ${err}`);
          }
        }
      } catch (err: any) {
        this.logger.error(`Error fetching push notification receipts: ${err?.message || String(err)}`);
      }
    }

    return { deliveredIds, failedIds };
  }
}
