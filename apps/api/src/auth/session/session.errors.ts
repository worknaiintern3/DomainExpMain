export class InvalidRefreshTokenError extends Error {
  readonly code = 'INVALID_REFRESH_TOKEN';

  constructor() {
    super('Authentication failed');
    this.name = 'InvalidRefreshTokenError';
  }
}

export class SessionPersistenceError extends Error {
  readonly code = 'SESSION_PERSISTENCE_ERROR';

  constructor() {
    super('Session operation could not be completed');
    this.name = 'SessionPersistenceError';
  }
}
