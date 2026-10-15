import { z } from 'zod';

export const GooglePlayStatusResponseSchema = z.object({
  connected: z.boolean(),
  googleAccount: z
    .object({
      email: z.string().email(),
    })
    .optional(),
  developerAccount: z
    .object({
      id: z.string(),
    })
    .optional(),
});

export type GooglePlayStatusResponse = z.infer<
  typeof GooglePlayStatusResponseSchema
>;

export const GooglePlayVerifyAccountRequestSchema = z.object({
  developerAccountId: z
    .string()
    .trim()
    .min(1, 'Developer Account ID is required'),
});

export type GooglePlayVerifyAccountRequest = z.infer<
  typeof GooglePlayVerifyAccountRequestSchema
>;

export const GooglePlayAppSchema = z.object({
  packageName: z.string(),
  appName: z.string(),
  playStoreUrl: z.string().url(),
});

export type GooglePlayApp = z.infer<typeof GooglePlayAppSchema>;

export const GooglePlayAppsResponseSchema = z.object({
  success: z.boolean(),
  developerAccount: z.object({
    id: z.string(),
  }),
  googleAccount: z.object({
    email: z.string().email(),
  }),
  apps: z.array(GooglePlayAppSchema),
});

export type GooglePlayAppsResponse = z.infer<
  typeof GooglePlayAppsResponseSchema
>;
