export class AuthenticatedIdentityNotFoundError extends Error {
  readonly code = 'AUTHENTICATED_IDENTITY_NOT_FOUND';

  constructor() {
    super('Authentication failed');
    this.name = 'AuthenticatedIdentityNotFoundError';
  }
}

export class IdentityPersistenceError extends Error {
  readonly code = 'IDENTITY_PERSISTENCE_ERROR';

  constructor() {
    super('Identity lookup could not be completed');
    this.name = 'IdentityPersistenceError';
  }
}
