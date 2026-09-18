import type {
  ProviderErrorCode,
  SafeProviderError,
} from './provider-adapter.types';

export class ProviderAdapterError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryAfterSeconds: number | null;

  constructor(code: ProviderErrorCode, retryAfterSeconds: number | null = null) {
    super('Provider request failed');
    this.name = 'ProviderAdapterError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ProviderReconciliationError extends Error {
  readonly code: 'CONNECTION_UNAVAILABLE' | 'INTERNAL_INTEGRITY_ERROR';

  constructor(
    code: 'CONNECTION_UNAVAILABLE' | 'INTERNAL_INTEGRITY_ERROR',
  ) {
    super('Provider reconciliation failed');
    this.name = 'ProviderReconciliationError';
    this.code = code;
  }
}

export function safeProviderError(error: unknown): SafeProviderError {
  return error instanceof ProviderAdapterError
    ? { code: error.code, retryAfterSeconds: error.retryAfterSeconds }
    : { code: 'UNKNOWN_PROVIDER_ERROR', retryAfterSeconds: null };
}
