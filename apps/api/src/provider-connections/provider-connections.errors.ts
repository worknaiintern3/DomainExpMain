export class ProviderConnectionNotFoundError extends Error {
  constructor() {
    super('Provider connection not found');
    this.name = 'ProviderConnectionNotFoundError';
  }
}

export class ProviderConnectionWriteForbiddenError extends Error {
  constructor() {
    super('Provider connection write access denied');
    this.name = 'ProviderConnectionWriteForbiddenError';
  }
}

export class ProviderConnectionAlreadyExistsError extends Error {
  constructor() {
    super('A connection already exists for this provider account');
    this.name = 'ProviderConnectionAlreadyExistsError';
  }
}

export class ProviderConnectionDisconnectedError extends Error {
  constructor() {
    super('Provider connection is disconnected');
    this.name = 'ProviderConnectionDisconnectedError';
  }
}

/** Safe: carries only the bounded canonical provider error code, never raw upstream detail. */
export class ProviderCredentialValidationFailedError extends Error {
  readonly validationErrorCode: string;

  constructor(validationErrorCode: string) {
    super('Provider credential validation failed');
    this.name = 'ProviderCredentialValidationFailedError';
    this.validationErrorCode = validationErrorCode;
  }
}

/**
 * A validation *attempt* failed for a transient/upstream reason (rate limit,
 * timeout, upstream unavailable/bad response, unknown provider error) rather
 * than the credential itself being rejected. The caller must not mutate the
 * connection's persisted validation state when this is thrown -- the
 * previous truthful state (VALID/INVALID) stands until a real answer is
 * obtained. Carries only the bounded canonical code, never raw upstream detail.
 */
export class ProviderValidationAttemptFailedError extends Error {
  readonly providerErrorCode: string;

  constructor(providerErrorCode: string) {
    super('Provider credential validation attempt failed');
    this.name = 'ProviderValidationAttemptFailedError';
    this.providerErrorCode = providerErrorCode;
  }
}

export class InvalidProviderAccountError extends Error {
  constructor() {
    super('Provider account is not a valid Cloudflare account in this workspace');
    this.name = 'InvalidProviderAccountError';
  }
}

export class InvalidIdempotencyKeyError extends Error {
  constructor() {
    super('Invalid or missing Idempotency-Key header');
    this.name = 'InvalidIdempotencyKeyError';
  }
}

export class ProviderConnectionPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderConnectionPersistenceError';
  }
}
