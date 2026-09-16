import type {
  ProviderConnectionAuthType,
  ProviderErrorCode,
} from './provider-connections.types';

/**
 * Structural shape every provider's token/credential validator satisfies
 * (CloudflareTokenValidator, GoDaddyTokenValidator, NamecheapTokenValidator,
 * HostingerTokenValidator). Each validator keeps its own distinctly-named
 * error class -- this file never imports or re-exports any of them -- so
 * routing stays a small, additive registry rather than a shared rewrite of
 * the validators themselves.
 */
export interface ProviderCredentialValidator {
  isTokenActive(token: string): Promise<boolean>;
}

export type ProviderCredentialValidatorRegistry = ReadonlyMap<
  ProviderConnectionAuthType,
  ProviderCredentialValidator
>;

export class UnroutableProviderAuthTypeError extends Error {
  constructor(authType: string) {
    super(`No credential validator is registered for auth type ${authType}`);
    this.name = 'UnroutableProviderAuthTypeError';
  }
}

export function selectProviderCredentialValidator(
  registry: ProviderCredentialValidatorRegistry,
  authType: ProviderConnectionAuthType,
): ProviderCredentialValidator {
  const validator = registry.get(authType);
  if (!validator) {
    // Unreachable in practice: every `provider_connection_auth_type` enum
    // value has a registered validator (see provider-connections.module.ts).
    // Fails closed rather than silently routing to the wrong provider.
    throw new UnroutableProviderAuthTypeError(authType);
  }
  return validator;
}

/**
 * Every validator's own error class carries a `.code: ProviderErrorCode`
 * field with an identical shape (see each validator's file). Extracting it
 * structurally here -- instead of importing all four concrete error
 * classes -- is what keeps this registry independent of which providers
 * exist.
 */
export function getProviderValidationErrorCode(error: unknown): ProviderErrorCode {
  if (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    return (error as { code: ProviderErrorCode }).code;
  }
  return 'UNKNOWN_PROVIDER_ERROR';
}
