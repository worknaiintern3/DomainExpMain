import { z } from 'zod';

import { ProviderConnectionAuthTypeSchema } from './provider-connections.schemas';

/**
 * Phase 10E: REST surface for provider connections. Kept in a separate file
 * from the Phase 10B contract (`provider-connections.schemas.ts`) so the
 * locked Phase 10B schemas are never edited. Every response here is a safe
 * projection: no ciphertext, IV, auth tag, key version, plaintext credential,
 * or raw provider payload ever appears.
 */

const CANONICAL_ERROR_CODE = /^[A-Z0-9_]{1,64}$/u;

export const ProviderConnectionStatusSchema = z.enum(['CONNECTED', 'DISCONNECTED']);
export const ProviderConnectionValidationStatusApiSchema = z.enum([
  'PENDING',
  'VALID',
  'INVALID',
]);
export const ProviderConnectionSyncStatusApiSchema = z.enum([
  'IDLE',
  'PENDING',
  'SYNCING',
  'SUCCESS',
  'FAILED',
]);
export const ProviderSyncRunTriggerSchema = z.enum([
  'INITIAL',
  'MANUAL',
  'SCHEDULED',
  'RETRY',
]);
export const ProviderSyncRunStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'SUCCESS',
  'PARTIAL',
  'FAILED',
]);

export const ProviderConnectionSummaryResponseSchema = z
  .object({
    authType: ProviderConnectionAuthTypeSchema,
    connectionStatus: ProviderConnectionStatusSchema,
    createdAt: z.iso.datetime({ offset: true }),
    credentialMask: z.string().min(1).max(255),
    disconnectedAt: z.iso.datetime({ offset: true }).nullable(),
    id: z.uuid(),
    lastSyncAt: z.iso.datetime({ offset: true }).nullable(),
    lastValidatedAt: z.iso.datetime({ offset: true }).nullable(),
    nextSyncAt: z.iso.datetime({ offset: true }).nullable(),
    providerAccountId: z.uuid(),
    providerAccountLabel: z.string().min(1).max(255),
    providerType: z.string().min(1).max(64),
    syncStatus: ProviderConnectionSyncStatusApiSchema,
    updatedAt: z.iso.datetime({ offset: true }),
    validationErrorCode: z.string().regex(CANONICAL_ERROR_CODE).nullable(),
    validationStatus: ProviderConnectionValidationStatusApiSchema,
  })
  .strict();

export const ProviderConnectionCollectionResponseSchema = z
  .object({
    items: z.array(ProviderConnectionSummaryResponseSchema),
  })
  .strict();

export const CreateProviderConnectionApiRequestSchema = z
  .object({
    authType: ProviderConnectionAuthTypeSchema,
    credential: z.string().min(1).max(4_096),
    providerAccountId: z.uuid(),
  })
  .strict();

export const ReplaceProviderConnectionCredentialRequestSchema = z
  .object({
    credential: z.string().min(1).max(4_096),
  })
  .strict();

export const ProviderConnectionValidateResponseSchema = z
  .object({
    lastValidatedAt: z.iso.datetime({ offset: true }).nullable(),
    validationErrorCode: z.string().regex(CANONICAL_ERROR_CODE).nullable(),
    validationStatus: ProviderConnectionValidationStatusApiSchema,
  })
  .strict();

export const ManualProviderSyncResponseSchema = z
  .object({
    id: z.uuid(),
    message: z.string(),
    status: z.literal('QUEUED'),
    trigger: z.literal('MANUAL'),
  })
  .strict();

export const ProviderSyncRunResponseSchema = z
  .object({
    attemptNo: z.number().int().min(1),
    createdAt: z.iso.datetime({ offset: true }),
    durationMs: z.number().int().nonnegative().nullable(),
    errorCode: z.string().regex(CANONICAL_ERROR_CODE).nullable(),
    finishedAt: z.iso.datetime({ offset: true }).nullable(),
    id: z.uuid(),
    itemsCreated: z.number().int().nonnegative(),
    itemsDiscovered: z.number().int().nonnegative(),
    itemsMissing: z.number().int().nonnegative(),
    itemsUnchanged: z.number().int().nonnegative(),
    itemsUpdated: z.number().int().nonnegative(),
    startedAt: z.iso.datetime({ offset: true }).nullable(),
    status: ProviderSyncRunStatusSchema,
    trigger: ProviderSyncRunTriggerSchema,
  })
  .strict();

export const ProviderSyncRunCollectionResponseSchema = z
  .object({
    items: z.array(ProviderSyncRunResponseSchema),
  })
  .strict();

export const ProviderConnectionDisconnectResponseSchema = z
  .object({
    connectionStatus: z.literal('DISCONNECTED'),
    disconnectedAt: z.iso.datetime({ offset: true }),
    id: z.uuid(),
  })
  .strict();

export type ProviderConnectionStatus = z.infer<typeof ProviderConnectionStatusSchema>;
export type ProviderConnectionSummaryResponse = z.infer<
  typeof ProviderConnectionSummaryResponseSchema
>;
export type ProviderConnectionCollectionResponse = z.infer<
  typeof ProviderConnectionCollectionResponseSchema
>;
export type CreateProviderConnectionApiRequest = z.infer<
  typeof CreateProviderConnectionApiRequestSchema
>;
export type ReplaceProviderConnectionCredentialRequest = z.infer<
  typeof ReplaceProviderConnectionCredentialRequestSchema
>;
export type ProviderConnectionValidateResponse = z.infer<
  typeof ProviderConnectionValidateResponseSchema
>;
export type ManualProviderSyncResponse = z.infer<typeof ManualProviderSyncResponseSchema>;
export type ProviderSyncRunResponse = z.infer<typeof ProviderSyncRunResponseSchema>;
export type ProviderSyncRunCollectionResponse = z.infer<
  typeof ProviderSyncRunCollectionResponseSchema
>;
export type ProviderConnectionDisconnectResponse = z.infer<
  typeof ProviderConnectionDisconnectResponseSchema
>;
