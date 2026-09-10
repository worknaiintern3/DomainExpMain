import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';

import { InvalidInventoryInputError } from '../inventory.errors';

const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;
const MAX_DOMAIN_LENGTH = 253;
const MAX_DOMAIN_LABEL_LENGTH = 63;

export interface NormalizedEmail {
  readonly email: string;
  readonly normalizedEmail: string;
}

export interface NormalizedProjectName {
  readonly name: string;
  readonly normalizedName: string;
}

export interface NormalizedDomainName {
  readonly domainName: string;
  readonly normalizedDomainName: string;
}

export function normalizeInventoryEmail(email: string): NormalizedEmail {
  const cleanedEmail = email.trim();
  return {
    email: cleanedEmail,
    normalizedEmail: cleanedEmail.toLowerCase(),
  };
}

export function normalizeProjectName(name: string): NormalizedProjectName {
  const cleanedName = name.trim();
  return {
    name: cleanedName,
    normalizedName: cleanedName.toLowerCase(),
  };
}

export function normalizeDomainName(domainName: string): NormalizedDomainName {
  const cleanedDomainName = domainName.trim().replace(/\.$/u, '');
  if (
    cleanedDomainName.length === 0 ||
    cleanedDomainName.includes('*') ||
    /\s/u.test(cleanedDomainName)
  ) {
    throw new InvalidInventoryInputError();
  }

  let asciiDomainName: string;
  try {
    asciiDomainName = domainToASCII(cleanedDomainName).toLowerCase();
  } catch {
    throw new InvalidInventoryInputError();
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
    throw new InvalidInventoryInputError();
  }

  return {
    domainName: cleanedDomainName,
    normalizedDomainName: asciiDomainName,
  };
}

export function normalizeOptionalHostname(
  hostname: string | null | undefined,
): string | null | undefined {
  if (hostname === null || hostname === undefined) {
    return hostname;
  }
  return hostname.trim().toLowerCase().replace(/\.$/u, '');
}

export function validateOptionalIpAddress(
  address: string | null | undefined,
): string | null | undefined {
  if (address === null || address === undefined) {
    return address;
  }
  if (isIP(address) === 0) {
    throw new InvalidInventoryInputError();
  }
  return address;
}
