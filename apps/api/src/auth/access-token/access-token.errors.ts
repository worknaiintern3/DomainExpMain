export class AccessTokenConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessTokenConfigurationError';
  }
}

export class InvalidAccessTokenError extends Error {
  readonly code = 'INVALID_ACCESS_TOKEN';

  constructor() {
    super('Authentication failed');
    this.name = 'InvalidAccessTokenError';
  }
}
