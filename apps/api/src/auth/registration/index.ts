export { normalizeRegistrationEmail } from './email-normalization';
export {
  RegistrationEmailConflictError,
  RegistrationPersistenceError,
} from './registration.errors';
export { PostgresRegistrationRepository } from './registration.repository';
export { RegistrationService } from './registration.service';
export type {
  PersistRegistrationInput,
  RegisteredUser,
  RegisterUserInput,
  RegistrationPasswordHasher,
  RegistrationStore,
  RegistrationTransactionHost,
} from './registration.types';
