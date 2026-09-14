import { isIP } from 'node:net';

import {
  InvalidDomainNameError,
  normalizeDomainName as normalizeCanonicalDomainName,
} from '@domainpulse/database';

import { InvalidInventoryInputError } from '../inventory.errors';

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
  try {
    return normalizeCanonicalDomainName(domainName);
  } catch (error) {
    if (error instanceof InvalidDomainNameError) {
      throw new InvalidInventoryInputError();
    }
    throw error;
  }
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
