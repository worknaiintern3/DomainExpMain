import { z } from 'zod';

export const AssetExpiryTypeSchema = z.enum([
  'domain',
  'server',
  'hosting',
  'ssl',
]);
export type AssetExpiryType = z.infer<typeof AssetExpiryTypeSchema>;

export const NotificationPlatformSchema = z.enum(['android', 'ios', 'web']);
export type NotificationPlatform = z.infer<typeof NotificationPlatformSchema>;

export const RegisterNotificationDeviceRequestSchema = z.object({
  expoPushToken: z.string().min(10).max(512),
  platform: NotificationPlatformSchema.default('android'),
  deviceName: z.string().max(256).optional(),
  appVersion: z.string().max(64).optional(),
});
export type RegisterNotificationDeviceRequest = z.infer<
  typeof RegisterNotificationDeviceRequestSchema
>;

export const NotificationPreferencesResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  workspaceId: z.string(),
  pushEnabled: z.boolean(),
  reminderThresholds: z.array(z.number().int().min(0).max(365)),
  notifyDomains: z.boolean(),
  notifyServers: z.boolean(),
  notifyHosting: z.boolean(),
  notifySsl: z.boolean(),
  timeZone: z.string(),
  preferredHour: z.number().int().min(0).max(23),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NotificationPreferencesResponse = z.infer<
  typeof NotificationPreferencesResponseSchema
>;

export const UpdateNotificationPreferencesRequestSchema = z.object({
  pushEnabled: z.boolean().optional(),
  reminderThresholds: z.array(z.number().int().min(0).max(365)).optional(),
  notifyDomains: z.boolean().optional(),
  notifyServers: z.boolean().optional(),
  notifyHosting: z.boolean().optional(),
  notifySsl: z.boolean().optional(),
  timeZone: z.string().max(64).optional(),
  preferredHour: z.number().int().min(0).max(23).optional(),
});
export type UpdateNotificationPreferencesRequest = z.infer<
  typeof UpdateNotificationPreferencesRequestSchema
>;

export const NotificationHistoryStatusSchema = z.enum([
  'QUEUED',
  'SENT',
  'DELIVERED',
  'FAILED',
]);
export type NotificationHistoryStatus = z.infer<
  typeof NotificationHistoryStatusSchema
>;

export const NotificationHistoryItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  workspaceId: z.string(),
  assetId: z.string(),
  assetType: AssetExpiryTypeSchema,
  assetName: z.string(),
  hostname: z.string().nullable().optional(),
  expiryDate: z.string(),
  reminderThreshold: z.number().int(),
  notificationTitle: z.string(),
  notificationBody: z.string(),
  notificationData: z.record(z.string(), z.any()).optional(),
  status: NotificationHistoryStatusSchema,
  providerTicketId: z.string().nullable().optional(),
  providerReceiptId: z.string().nullable().optional(),
  failureReason: z.string().nullable().optional(),
  isRead: z.boolean(),
  sentAt: z.string(),
  createdAt: z.string(),
});
export type NotificationHistoryItem = z.infer<
  typeof NotificationHistoryItemSchema
>;

export const UpsertAssetExpiryRequestSchema = z.object({
  assetId: z.string().min(1).max(256),
  assetType: AssetExpiryTypeSchema,
  assetName: z.string().min(1).max(256),
  hostname: z.string().max(256).nullable().optional(),
  expiryDate: z.string().datetime(),
  providerAccountId: z.string().uuid().nullable().optional(),
  providerKey: z.string().max(64).nullable().optional(),
  autoRenew: z.boolean().optional(),
  source: z
    .enum(['REGISTRAR_API', 'TLS_CERTIFICATE', 'PROVIDER_SYNC', 'USER_ENTERED'])
    .optional(),
  notes: z.string().max(1024).optional(),
});
export type UpsertAssetExpiryRequest = z.infer<
  typeof UpsertAssetExpiryRequestSchema
>;

export const TriggerExpiryCheckRequestSchema = z.object({
  dryRun: z.boolean().optional(),
  simulatedDaysRemaining: z.number().int().min(0).max(365).optional(),
  targetAssetId: z.string().optional(),
});
export type TriggerExpiryCheckRequest = z.infer<
  typeof TriggerExpiryCheckRequestSchema
>;
