import { domainToASCII } from 'node:url';

const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;
const MAX_DOMAIN_LENGTH = 253;
const MAX_DOMAIN_LABEL_LENGTH = 63;

export interface NormalizedDomainName {
  readonly domainName: string;
  readonly normalizedDomainName: string;
}

export class InvalidDomainNameError extends Error {
  constructor() {
    super('Invalid domain name');
    this.name = 'InvalidDomainNameError';
  }
}

/**
 * Canonical DomainPulse domain normalization shared by inventory writes and
 * provider discovery. Unicode names are converted to lower-case IDNA ASCII.
 */
export function normalizeDomainName(domainName: string): NormalizedDomainName {
  const cleanedDomainName = domainName.trim().replace(/\.$/u, '');
  if (
    cleanedDomainName.length === 0 ||
    cleanedDomainName.includes('*') ||
    /\s/u.test(cleanedDomainName)
  ) {
    throw new InvalidDomainNameError();
  }

  let asciiDomainName: string;
  try {
    asciiDomainName = domainToASCII(cleanedDomainName).toLowerCase();
  } catch {
    throw new InvalidDomainNameError();
  }

  const labels = asciiDomainName.split('.');
  if (
    asciiDomainName.length === 0 ||
    asciiDomainName.length > MAX_DOMAIN_LENGTH ||
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > MAX_DOMAIN_LABEL_LENGTH ||
        !DOMAIN_LABEL_PATTERN.test(label),
    )
  ) {
    throw new InvalidDomainNameError();
  }

  return {
    domainName: cleanedDomainName,
    normalizedDomainName: asciiDomainName,
  };
}
