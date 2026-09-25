export class RegistrationEmailConflictError extends Error {
  readonly code = 'REGISTRATION_EMAIL_CONFLICT';

  constructor() {
    super('An account with this email already exists');
    this.name = 'RegistrationEmailConflictError';
  }
}

export class RegistrationPersistenceError extends Error {
  readonly code = 'REGISTRATION_PERSISTENCE_ERROR';

  constructor(message?: string) {
    super(message || 'Registration could not be completed');
    this.name = 'RegistrationPersistenceError';
  }
}
