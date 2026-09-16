import { z } from 'zod';

export const ProviderConnectionAuthTypeSchema = z.enum([
  'CLOUDFLARE_API_TOKEN',
  'GODADDY_PAT',
  'NAMECHEAP_API_KEY',
  'HOSTINGER_API_TOKEN',
]);
export const ProviderConnectionValidationStatusSchema = z.enum([
  'PENDING',
  'VALID',
  'INVALID',
]);
export const ProviderConnectionSyncStatusSchema = z.enum([
  'IDLE',
  'PENDING',
  'SYNCING',
  'SUCCESS',
  'FAILED',
]);

/**
 * Transport-only credential input for future provider-connection routes.
 * The plaintext credential is validated here, encrypted server-side with
 * AES-256-GCM, and never persisted or echoed back. Phase 10B defines the
 * contract only; no routes or external provider calls exist yet.
 */
export const CreateProviderConnectionRequestSchema = z
  .object({
    authType: ProviderConnectionAuthTypeSchema,
    credential: z.string().min(1).max(4_096),
    providerAccountId: z.uuid(),
  })
  .strict();

/** Rotation input carries only the replacement credential, never stored state. */
export const UpdateProviderConnectionCredentialRequestSchema = z
  .object({
    credential: z.string().min(1).max(4_096),
  })
  .strict();

/**
 * Status-only connection view. Encrypted envelope fields (ciphertext, IV,
 * auth tag) and plaintext credentials must never appear in responses; only the
 * display mask and lifecycle state are exposed.
 */
export const ProviderConnectionResponseSchema = z
  .object({
    authType: ProviderConnectionAuthTypeSchema,
    createdAt: z.iso.datetime({ offset: true }),
    credentialMask: z.string().min(1).max(255),
    id: z.uuid(),
    keyVersion: z.number().int().min(1),
    lastSyncAt: z.iso.datetime({ offset: true }).nullable(),
    lastValidatedAt: z.iso.datetime({ offset: true }).nullable(),
    nextSyncAt: z.iso.datetime({ offset: true }).nullable(),
    providerAccountId: z.uuid(),
    syncStatus: ProviderConnectionSyncStatusSchema,
    updatedAt: z.iso.datetime({ offset: true }),
    validationStatus: ProviderConnectionValidationStatusSchema,
  })
  .strict();

export type ProviderConnectionAuthType = z.infer<
  typeof ProviderConnectionAuthTypeSchema
>;
export type ProviderConnectionValidationStatus = z.infer<
  typeof ProviderConnectionValidationStatusSchema
>;
export type ProviderConnectionSyncStatus = z.infer<
  typeof ProviderConnectionSyncStatusSchema
>;
export type CreateProviderConnectionRequest = z.infer<
  typeof CreateProviderConnectionRequestSchema
>;
export type UpdateProviderConnectionCredentialRequest = z.infer<
  typeof UpdateProviderConnectionCredentialRequestSchema
>;
export type ProviderConnectionResponse = z.infer<
  typeof ProviderConnectionResponseSchema
>;
