import { z } from 'zod';

export const MobilePlatformRoleSchema = z.enum([
  'SUPER_ADMIN',
  'ADMIN',
  'SUPPORT',
  'USER',
]);
export type MobilePlatformRole = z.infer<typeof MobilePlatformRoleSchema>;

export const MobileAppConfigSchema = z
  .object({
    appName: z.string().min(1).max(100),
    logoUrl: z.string().nullable().optional(),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    maintenanceMode: z.boolean(),
    maintenanceMessage: z.string().nullable().optional(),
  })
  .strict();
export type MobileAppConfig = z.infer<typeof MobileAppConfigSchema>;

export const MobileFeatureFlagSchema = z
  .object({
    key: z.string().min(1).max(50),
    name: z.string().min(1).max(100),
    description: z.string().nullable().optional(),
    enabled: z.boolean(),
    minAppVersion: z.string().nullable().optional(),
  })
  .strict();
export type MobileFeatureFlag = z.infer<typeof MobileFeatureFlagSchema>;

export const MobileNavigationItemSchema = z
  .object({
    key: z.string().min(1).max(50),
    label: z.string().min(1).max(50),
    icon: z.string().min(1).max(50),
    route: z.string().min(1).max(100),
    sortOrder: z.number().int(),
    enabled: z.boolean(),
    badge: z.string().nullable().optional(),
  })
  .strict();
export type MobileNavigationItem = z.infer<typeof MobileNavigationItemSchema>;

export const MobileHomeSectionSchema = z
  .object({
    sectionKey: z.string().min(1).max(50),
    title: z.string().min(1).max(100),
    sortOrder: z.number().int(),
    enabled: z.boolean(),
    configJson: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict();
export type MobileHomeSection = z.infer<typeof MobileHomeSectionSchema>;

export const MobileAnnouncementSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(150),
    message: z.string().min(1).max(1000),
    type: z.enum(['info', 'warning', 'critical', 'promo']),
    actionUrl: z.string().nullable().optional(),
    actionLabel: z.string().nullable().optional(),
    isActive: z.boolean(),
    startsAt: z.string().nullable().optional(),
    expiresAt: z.string().nullable().optional(),
  })
  .strict();
export type MobileAnnouncement = z.infer<typeof MobileAnnouncementSchema>;

export const MobileAppVersionSchema = z
  .object({
    platform: z.enum(['ios', 'android', 'all']),
    minimumVersion: z.string().min(1),
    latestVersion: z.string().min(1),
    forceUpdate: z.boolean(),
    updateUrl: z.string().nullable().optional(),
    releaseNotes: z.string().nullable().optional(),
  })
  .strict();
export type MobileAppVersion = z.infer<typeof MobileAppVersionSchema>;

export const MobileBootstrapConfigResponseSchema = z
  .object({
    app: MobileAppConfigSchema,
    features: z.record(z.string(), z.boolean()),
    featureFlags: z.array(MobileFeatureFlagSchema),
    navigation: z.array(MobileNavigationItemSchema),
    homeSections: z.array(MobileHomeSectionSchema),
    version: MobileAppVersionSchema,
    announcements: z.array(MobileAnnouncementSchema),
  })
  .strict();
export type MobileBootstrapConfigResponse = z.infer<
  typeof MobileBootstrapConfigResponseSchema
>;

/* ----------------- Admin Mutation Schemas ----------------- */

export const UpdateMobileAppConfigRequestSchema = z
  .object({
    appName: z.string().min(1).max(100).optional(),
    logoUrl: z.string().nullable().optional(),
    primaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    secondaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    maintenanceMode: z.boolean().optional(),
    maintenanceMessage: z.string().nullable().optional(),
  })
  .strict();
export type UpdateMobileAppConfigRequest = z.infer<
  typeof UpdateMobileAppConfigRequestSchema
>;

export const UpdateMobileFeatureFlagRequestSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().nullable().optional(),
    enabled: z.boolean().optional(),
    minAppVersion: z.string().nullable().optional(),
  })
  .strict();
export type UpdateMobileFeatureFlagRequest = z.infer<
  typeof UpdateMobileFeatureFlagRequestSchema
>;

export const UpdateMobileNavigationRequestSchema = z
  .object({
    items: z.array(
      z.object({
        key: z.string().min(1).max(50),
        label: z.string().min(1).max(50),
        icon: z.string().min(1).max(50),
        route: z.string().min(1).max(100),
        sortOrder: z.number().int(),
        enabled: z.boolean(),
        badge: z.string().nullable().optional(),
      }),
    ),
  })
  .strict();
export type UpdateMobileNavigationRequest = z.infer<
  typeof UpdateMobileNavigationRequestSchema
>;

export const UpdateMobileHomeConfigRequestSchema = z
  .object({
    sections: z.array(
      z.object({
        sectionKey: z.string().min(1).max(50),
        title: z.string().min(1).max(100),
        sortOrder: z.number().int(),
        enabled: z.boolean(),
        configJson: z.record(z.string(), z.unknown()).nullable().optional(),
      }),
    ),
  })
  .strict();
export type UpdateMobileHomeConfigRequest = z.infer<
  typeof UpdateMobileHomeConfigRequestSchema
>;

export const CreateMobileAnnouncementRequestSchema = z
  .object({
    title: z.string().min(1).max(150),
    message: z.string().min(1).max(1000),
    type: z.enum(['info', 'warning', 'critical', 'promo']).default('info'),
    actionUrl: z.string().nullable().optional(),
    actionLabel: z.string().nullable().optional(),
    isActive: z.boolean().default(true),
    startsAt: z.string().nullable().optional(),
    expiresAt: z.string().nullable().optional(),
  })
  .strict();
export type CreateMobileAnnouncementRequest = z.infer<
  typeof CreateMobileAnnouncementRequestSchema
>;

export const UpdateMobileAnnouncementRequestSchema = z
  .object({
    title: z.string().min(1).max(150).optional(),
    message: z.string().min(1).max(1000).optional(),
    type: z.enum(['info', 'warning', 'critical', 'promo']).optional(),
    actionUrl: z.string().nullable().optional(),
    actionLabel: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    startsAt: z.string().nullable().optional(),
    expiresAt: z.string().nullable().optional(),
  })
  .strict();
export type UpdateMobileAnnouncementRequest = z.infer<
  typeof UpdateMobileAnnouncementRequestSchema
>;

export const UpdateMobileAppVersionRequestSchema = z
  .object({
    minimumVersion: z.string().min(1).optional(),
    latestVersion: z.string().min(1).optional(),
    forceUpdate: z.boolean().optional(),
    updateUrl: z.string().nullable().optional(),
    releaseNotes: z.string().nullable().optional(),
  })
  .strict();
export type UpdateMobileAppVersionRequest = z.infer<
  typeof UpdateMobileAppVersionRequestSchema
>;

export const MobileAuditLogResponseSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid().nullable(),
    action: z.string(),
    target: z.string(),
    details: z.string().nullable(),
    ipAddress: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();
export type MobileAuditLogResponse = z.infer<
  typeof MobileAuditLogResponseSchema
>;
