import { createHash, randomUUID } from 'node:crypto';

import {
  decryptProviderCredential,
  encryptProviderCredential,
  ProviderCredentialCryptoError,
  type ProviderCredentialKeyStore,
} from '@domainpulse/database';

import { getPostgreSqlErrorCode } from '../common/postgres-error';
import {
  CloudflareTokenValidationError,
  type CloudflareTokenValidator,
} from './cloudflare-token-validator';
import { buildCredentialMask } from './provider-connection-mask';
import {
  InvalidIdempotencyKeyError,
  ProviderConnectionAlreadyExistsError,
  ProviderConnectionDisconnectedError,
  ProviderConnectionNotFoundError,
  ProviderConnectionPersistenceError,
  ProviderConnectionWriteForbiddenError,
  ProviderCredentialValidationFailedError,
  ProviderValidationAttemptFailedError,
} from './provider-connections.errors';
import type {
  ProviderConnectionSummary,
  ProviderConnectionsStore,
  ProviderSyncRunSummary,
} from './provider-connections.types';

const MAX_IDEMPOTENCY_KEY_LENGTH = 256;
const DEFAULT_SYNC_RUNS_LIMIT = 20;
const MAX_SYNC_RUNS_LIMIT = 100;

/**
 * Codes that are a truthful statement about the credential itself (it is
 * rejected or lacks permission) and so may be persisted as INVALID. Every
 * other canonical code (rate limit, timeout, upstream unavailable/bad
 * response, unknown) describes a failed validation *attempt*, not a fact
 * about the credential, and must never overwrite the previous persisted state.
 */
const CREDENTIAL_REJECTION_CODES = new Set(['AUTH_INVALID', 'PERMISSION_DENIED']);

const WRITE_ALLOWED_ROLES = new Set(['admin', 'owner']);

/** Fail closed: only the explicitly allowed roles may write. Every other role -- including unknown ones -- is denied. */
function requireProviderConnectionWriteAccess(principal: { role: string }): void {
  if (!WRITE_ALLOWED_ROLES.has(principal.role)) {
    throw new ProviderConnectionWriteForbiddenError();
  }
}

function isUniqueViolation(error: unknown): boolean {
  const code = getPostgreSqlErrorCode(error);
  if (code !== undefined) {
    return code === '23505';
  }
  // Fallback only for shapes the cause-chain walk can't resolve a code
  // from; the code-based check above is always tried first.
  return error instanceof Error
    && (error.message.includes('23505') || error.message.includes('duplicate key'));
}

function deriveInternalIdempotencyKey(connectionId: string, userKey: string): string {
  return createHash('sha256').update(`${connectionId}:${userKey}`).digest('hex');
}

export interface ManualSyncResult {
  readonly id: string;
  readonly message: string;
  readonly status: 'QUEUED';
  readonly trigger: 'MANUAL';
}

export interface ValidationOutcome {
  readonly lastValidatedAt: string;
  readonly validationErrorCode: string | null;
  readonly validationStatus: 'VALID' | 'INVALID';
}

export class ProviderConnectionsService {
  constructor(
    private readonly store: ProviderConnectionsStore,
    private readonly credentialKeys: ProviderCredentialKeyStore,
    private readonly tokenValidator: CloudflareTokenValidator,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listConnections(
    principal: { workspaceId: string },
  ): Promise<readonly ProviderConnectionSummary[]> {
    return this.store.listSummaries(principal.workspaceId);
  }

  async getConnection(
    principal: { workspaceId: string },
    id: string,
  ): Promise<ProviderConnectionSummary> {
    const connection = await this.store.findSummaryById(principal.workspaceId, id);
    if (!connection) {
      throw new ProviderConnectionNotFoundError();
    }
    return connection;
  }

  async createConnection(
    principal: { role: string; workspaceId: string },
    input: { authType: 'CLOUDFLARE_API_TOKEN'; credential: string; providerAccountId: string },
  ): Promise<ProviderConnectionSummary> {
    requireProviderConnectionWriteAccess(principal);

    // Validated fully outside any DB transaction, before any persistence.
    await this.assertTokenActive(input.credential);

    // Generated before encryption: the AES-GCM envelope's AAD binds
    // ciphertext to this exact {workspaceId, connectionId} pair.
    const connectionId = randomUUID();
    const now = this.now();
    let encrypted;
    try {
      encrypted = encryptProviderCredential(
        input.credential,
        { connectionId, workspaceId: principal.workspaceId },
        this.credentialKeys,
      );
    } catch (error) {
      if (error instanceof ProviderCredentialCryptoError) {
        throw new ProviderConnectionPersistenceError('Failed to encrypt provider credential');
      }
      throw error;
    }

    try {
      return await this.store.createConnection(
        principal.workspaceId,
        {
          authType: input.authType,
          credentialMask: buildCredentialMask(input.credential),
          encryptedCiphertext: encrypted.ciphertextBase64,
          encryptionAuthTag: encrypted.authTagBase64,
          encryptionIv: encrypted.ivBase64,
          id: connectionId,
          keyVersion: encrypted.keyVersion,
          providerAccountId: input.providerAccountId,
          validatedAt: now,
        },
        now,
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ProviderConnectionAlreadyExistsError();
      }
      throw error;
    }
  }

  async validateConnection(
    principal: { role: string; workspaceId: string },
    id: string,
  ): Promise<ValidationOutcome> {
    requireProviderConnectionWriteAccess(principal);

    const envelope = await this.store.findEnvelopeById(principal.workspaceId, id);
    if (!envelope) {
      throw new ProviderConnectionNotFoundError();
    }
    if (
      envelope.connectionStatus !== 'CONNECTED'
      || envelope.encryptedCiphertext === null
      || envelope.encryptionIv === null
      || envelope.encryptionAuthTag === null
      || envelope.keyVersion === null
    ) {
      throw new ProviderConnectionDisconnectedError();
    }

    let plaintext: string;
    try {
      plaintext = decryptProviderCredential(
        {
          authTagBase64: envelope.encryptionAuthTag,
          ciphertextBase64: envelope.encryptedCiphertext,
          ivBase64: envelope.encryptionIv,
          keyVersion: envelope.keyVersion,
        },
        { connectionId: id, workspaceId: principal.workspaceId },
        this.credentialKeys,
      );
    } catch {
      throw new ProviderConnectionPersistenceError('Failed to decrypt provider credential');
    }

    const now = this.now();
    let validationStatus: 'VALID' | 'INVALID';
    let validationErrorCode: string | null;
    try {
      const active = await this.tokenValidator.isTokenActive(plaintext);
      validationStatus = active ? 'VALID' : 'INVALID';
      validationErrorCode = active ? null : 'AUTH_INVALID';
    } catch (error) {
      const code = error instanceof CloudflareTokenValidationError
        ? error.code
        : 'UNKNOWN_PROVIDER_ERROR';
      if (!CREDENTIAL_REJECTION_CODES.has(code)) {
        // Transient/upstream failure (rate limit, timeout, upstream
        // unavailable/bad response, unknown): this is not a truthful
        // statement about the credential, so the previous persisted
        // VALID/INVALID state must be left exactly as it was.
        throw new ProviderValidationAttemptFailedError(code);
      }
      validationStatus = 'INVALID';
      validationErrorCode = code;
    }
    // plaintext is not referenced again; nothing else retains it in memory.

    const updated = await this.store.updateValidationResult(principal.workspaceId, id, {
      validatedAt: now,
      validationErrorCode,
      validationStatus,
    });
    if (!updated) {
      throw new ProviderConnectionDisconnectedError();
    }

    return {
      lastValidatedAt: now.toISOString(),
      validationErrorCode,
      validationStatus,
    };
  }

  async replaceCredential(
    principal: { role: string; workspaceId: string },
    id: string,
    credential: string,
  ): Promise<ProviderConnectionSummary> {
    requireProviderConnectionWriteAccess(principal);

    const envelope = await this.store.findEnvelopeById(principal.workspaceId, id);
    if (!envelope) {
      throw new ProviderConnectionNotFoundError();
    }
    if (envelope.connectionStatus !== 'CONNECTED') {
      throw new ProviderConnectionDisconnectedError();
    }

    // Validate the replacement before touching the stored credential: if
    // this throws, the existing working credential is left untouched.
    await this.assertTokenActive(credential);

    const now = this.now();
    let encrypted;
    try {
      encrypted = encryptProviderCredential(
        credential,
        { connectionId: id, workspaceId: principal.workspaceId },
        this.credentialKeys,
      );
    } catch (error) {
      if (error instanceof ProviderCredentialCryptoError) {
        throw new ProviderConnectionPersistenceError('Failed to encrypt provider credential');
      }
      throw error;
    }

    const updated = await this.store.replaceCredential(principal.workspaceId, id, {
      credentialMask: buildCredentialMask(credential),
      encryptedCiphertext: encrypted.ciphertextBase64,
      encryptionAuthTag: encrypted.authTagBase64,
      encryptionIv: encrypted.ivBase64,
      keyVersion: encrypted.keyVersion,
      validatedAt: now,
    });
    if (!updated) {
      // Raced with a disconnect between the check above and this write.
      throw new ProviderConnectionDisconnectedError();
    }
    return updated;
  }

  async enqueueManualSync(
    principal: { role: string; workspaceId: string },
    id: string,
    rawIdempotencyKey: string | undefined,
  ): Promise<ManualSyncResult> {
    requireProviderConnectionWriteAccess(principal);

    if (
      typeof rawIdempotencyKey !== 'string'
      || rawIdempotencyKey.length === 0
      || rawIdempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH
    ) {
      throw new InvalidIdempotencyKeyError();
    }

    const connection = await this.store.findSummaryById(principal.workspaceId, id);
    if (!connection) {
      throw new ProviderConnectionNotFoundError();
    }
    if (connection.connectionStatus !== 'CONNECTED') {
      throw new ProviderConnectionDisconnectedError();
    }

    const internalKey = deriveInternalIdempotencyKey(id, rawIdempotencyKey);
    const existing = await this.store.findRunByIdempotencyKey(
      principal.workspaceId,
      id,
      internalKey,
    );
    if (existing) {
      return {
        id: existing.id,
        message: 'Provider sync already queued for this idempotency key',
        status: 'QUEUED',
        trigger: 'MANUAL',
      };
    }

    try {
      const run = await this.store.createManualSyncRun(
        principal.workspaceId,
        id,
        internalKey,
        this.now(),
      );
      return {
        id: run.id,
        message: 'Provider sync queued successfully',
        status: 'QUEUED',
        trigger: 'MANUAL',
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const concurrent = await this.store.findRunByIdempotencyKey(
          principal.workspaceId,
          id,
          internalKey,
        );
        if (concurrent) {
          return {
            id: concurrent.id,
            message: 'Provider sync already queued for this idempotency key',
            status: 'QUEUED',
            trigger: 'MANUAL',
          };
        }
      }
      throw error;
    }
  }

  async listSyncRuns(
    principal: { workspaceId: string },
    id: string,
    limit?: number,
  ): Promise<readonly ProviderSyncRunSummary[]> {
    const connection = await this.store.findSummaryById(principal.workspaceId, id);
    if (!connection) {
      throw new ProviderConnectionNotFoundError();
    }
    const bounded = Math.min(Math.max(limit ?? DEFAULT_SYNC_RUNS_LIMIT, 1), MAX_SYNC_RUNS_LIMIT);
    return this.store.listSyncRuns(principal.workspaceId, id, bounded);
  }

  async disconnect(
    principal: { role: string; workspaceId: string },
    id: string,
  ): Promise<{ connectionStatus: 'DISCONNECTED'; disconnectedAt: string; id: string }> {
    requireProviderConnectionWriteAccess(principal);

    const result = await this.store.disconnect(principal.workspaceId, id, this.now());
    if (!result) {
      throw new ProviderConnectionNotFoundError();
    }
    return {
      connectionStatus: 'DISCONNECTED',
      disconnectedAt: result.disconnectedAt.toISOString(),
      id: result.id,
    };
  }

  private async assertTokenActive(credential: string): Promise<void> {
    let active: boolean;
    try {
      active = await this.tokenValidator.isTokenActive(credential);
    } catch (error) {
      const code = error instanceof CloudflareTokenValidationError
        ? error.code
        : 'UNKNOWN_PROVIDER_ERROR';
      throw new ProviderCredentialValidationFailedError(code);
    }
    if (!active) {
      throw new ProviderCredentialValidationFailedError('AUTH_INVALID');
    }
  }
}
