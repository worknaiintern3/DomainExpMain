export const SERVER_KIND_MAX_LENGTH = 100;
export const SERVER_KIND_PATTERN_SOURCE = '[a-z0-9]+(?:[._-][a-z0-9]+)*';

const SERVER_KIND_PATTERN = new RegExp(`^${SERVER_KIND_PATTERN_SOURCE}$`, 'u');

export function validateServerKindInput(value: string): string | null {
  const serverKind = value.trim();
  if (serverKind === '') return null;
  if (serverKind.length > SERVER_KIND_MAX_LENGTH) {
    return `Use at most ${SERVER_KIND_MAX_LENGTH} characters.`;
  }
  if (!SERVER_KIND_PATTERN.test(serverKind)) {
    return 'Use lowercase letters or numbers, separated only by a dot, underscore, or hyphen.';
  }
  return null;
}
