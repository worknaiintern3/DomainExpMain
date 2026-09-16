const VISIBLE_SUFFIX_LENGTH = 4;
const MASK_PREFIX = '••••';

/**
 * Builds a display-only mask for a plaintext provider credential: a fixed
 * bullet prefix plus (at most) its last four characters. Never reversible,
 * never includes enough of the secret to reconstruct or narrow it further
 * than the API already allows through repeated attempts.
 */
export function buildCredentialMask(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (trimmed.length <= VISIBLE_SUFFIX_LENGTH) {
    return MASK_PREFIX;
  }
  return `${MASK_PREFIX}${trimmed.slice(-VISIBLE_SUFFIX_LENGTH)}`;
}

export const DISCONNECTED_CREDENTIAL_MASK = 'Disconnected';
