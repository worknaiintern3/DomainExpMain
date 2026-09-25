export class InvalidCredentialsError extends Error {
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class LoginPersistenceError extends Error {
  readonly code = 'LOGIN_PERSISTENCE_ERROR';

  constructor(message?: string) {
    super(message || 'Login could not be completed');
    this.name = 'LoginPersistenceError';
  }
}
