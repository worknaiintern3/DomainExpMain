import {
  decryptProviderCredential,
  ProviderCredentialCryptoError,
  type ProviderCredentialKeyStore,
} from '@domainpulse/database';

import { ProviderReconciliationError, safeProviderError } from '../provider.errors';
import type {
  ClaimedProviderSyncRun,
  ProviderConnectionForSync,
  ProviderSyncExecutionResult,
  ProviderSyncRunExecutor,
  ProviderSyncService,
} from './provider-sync.types';

const EMPTY_COUNTS = {
  itemsCreated: 0,
  itemsDiscovered: 0,
  itemsMissing: 0,
  itemsUnchanged: 0,
  itemsUpdated: 0,
} as const;

export class ProviderSyncExecutor implements ProviderSyncRunExecutor {
  constructor(
    private readonly syncServicesByProviderKey: ReadonlyMap<string, ProviderSyncService>,
    private readonly credentialKeys: ProviderCredentialKeyStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(
    _run: ClaimedProviderSyncRun,
    connection: ProviderConnectionForSync,
  ): Promise<ProviderSyncExecutionResult> {
    const startedAt = this.clock().getTime();

    if (
      connection.connectionStatus !== 'CONNECTED'
      || connection.encryptedCiphertext === null
      || connection.encryptionIv === null
      || connection.encryptionAuthTag === null
      || connection.keyVersion === null
    ) {
      // Raced with a disconnect (or credential rotation clearing the
      // envelope mid-flight) between claim and execution: fail this run
      // safely rather than touching a missing credential.
      return this.failure('CONNECTION_UNAVAILABLE', startedAt);
    }

    const syncService = this.syncServicesByProviderKey.get(connection.providerKey);
    if (!syncService) {
      return this.failure('UNKNOWN_PROVIDER_ERROR', startedAt);
    }

    let plaintext: string;
    try {
      plaintext = decryptProviderCredential(
        {
          authTagBase64: connection.encryptionAuthTag,
          ciphertextBase64: connection.encryptedCiphertext,
          ivBase64: connection.encryptionIv,
          keyVersion: connection.keyVersion,
        },
        { connectionId: connection.id, workspaceId: connection.workspaceId },
        this.credentialKeys,
      );
    } catch (error) {
      if (error instanceof ProviderCredentialCryptoError) {
        return this.failure('CONNECTION_UNAVAILABLE', startedAt);
      }
      throw error;
    }

    const synchronizedAt = this.clock();
    try {
      const result = await syncService.synchronize({
        connectionId: connection.id,
        synchronizedAt,
        token: plaintext,
        workspaceId: connection.workspaceId,
      });
      // plaintext is not referenced again past this point.
      const finishedAt = this.clock();
      const counts = {
        itemsCreated: result.itemsCreated,
        itemsDiscovered: result.itemsDiscovered,
        itemsMissing: result.itemsMissing,
        itemsUnchanged: result.itemsUnchanged,
        itemsUpdated: result.itemsUpdated,
      };
      if (result.completion === 'COMPLETE' && result.error === null) {
        return {
          ...counts,
          durationMs: finishedAt.getTime() - startedAt,
          errorCode: null,
          finishedAt,
          status: 'SUCCESS',
        };
      }
      return {
        ...counts,
        durationMs: finishedAt.getTime() - startedAt,
        errorCode: result.error?.code ?? 'UNKNOWN_PROVIDER_ERROR',
        finishedAt,
        status: 'PARTIAL',
      };
    } catch (error) {
      const finishedAt = this.clock();
      const code = error instanceof ProviderReconciliationError
        ? error.code
        : safeProviderError(error).code;
      return {
        ...EMPTY_COUNTS,
        durationMs: finishedAt.getTime() - startedAt,
        errorCode: code,
        finishedAt,
        status: 'FAILED',
      };
    }
  }

  private failure(code: string, startedAt: number): ProviderSyncExecutionResult {
    const finishedAt = this.clock();
    return {
      ...EMPTY_COUNTS,
      durationMs: finishedAt.getTime() - startedAt,
      errorCode: code,
      finishedAt,
      status: 'FAILED',
    };
  }
}
