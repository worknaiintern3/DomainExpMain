export class PasswordAlreadySetError extends Error {
  readonly code = 'PASSWORD_ALREADY_SET';

  constructor() {
    super('A password is already set for this account');
    this.name = 'PasswordAlreadySetError';
  }
}

/**
 * The one DB-enforced invariant this module protects: a user may never end
 * up with zero usable sign-in methods. Currently the only two methods are
 * password and Google, so this fires exactly when unlinking Google would
 * leave a user with no `password_credentials` row.
 */
export class LastLoginMethodError extends Error {
  readonly code = 'LAST_LOGIN_METHOD';

  constructor() {
    super('Add a password before disconnecting Google, so you always have a way to sign in');
    this.name = 'LastLoginMethodError';
  }
}

export class AccountPersistenceError extends Error {
  readonly code = 'ACCOUNT_PERSISTENCE_ERROR';

  constructor() {
    super('This request could not be completed');
    this.name = 'AccountPersistenceError';
  }
}
