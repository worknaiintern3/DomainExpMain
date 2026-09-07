import { hashPassword } from '../crypto';
import { normalizeRegistrationEmail } from './email-normalization';
import type {
  RegisterUserInput,
  RegisteredUser,
  RegistrationPasswordHasher,
  RegistrationStore,
} from './registration.types';

export class RegistrationService {
  constructor(
    private readonly registrationStore: RegistrationStore,
    private readonly passwordHasher: RegistrationPasswordHasher = hashPassword,
  ) {}

  async register(input: RegisterUserInput): Promise<RegisteredUser> {
    const email = input.email.trim();
    const normalizedEmail = normalizeRegistrationEmail(email);
    const passwordHash = await this.passwordHasher(input.password);

    return this.registrationStore.createRegistration({
      ...(input.displayName === undefined
        ? {}
        : { displayName: input.displayName }),
      email,
      normalizedEmail,
      passwordHash,
    });
  }
}
