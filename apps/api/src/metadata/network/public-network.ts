import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface ResolvedAddress {
  readonly address: string;
  readonly family: number;
}

export type HostLookup = (hostname: string) => Promise<readonly ResolvedAddress[]>;

export class UnsafeNetworkTargetError extends Error {
  constructor() {
    super('Unsafe network target');
    this.name = 'UnsafeNetworkTargetError';
  }
}

export const systemHostLookup: HostLookup = async (hostname) =>
  await lookup(hostname, { all: true, verbatim: true });

function isPublicIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const [a = 0, b = 0, c = 0] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function mappedIpv4Address(address: string): string | null {
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/u.exec(address)?.[1];

  if (dotted) {
    return dotted;
  }

  const hexadecimal = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u.exec(address);

  if (!hexadecimal) {
    return null;
  }

  const high = Number.parseInt(hexadecimal[1] ?? '', 16);
  const low = Number.parseInt(hexadecimal[2] ?? '', 16);

  if (
    !Number.isInteger(high)
    || !Number.isInteger(low)
    || high < 0
    || high > 0xffff
    || low < 0
    || low > 0xffff
  ) {
    return null;
  }

  return [
    (high >> 8) & 0xff,
    high & 0xff,
    (low >> 8) & 0xff,
    low & 0xff,
  ].join('.');
}

function isPublicIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split('%', 1)[0] ?? '';

  if (normalized === '::' || normalized === '::1') {
    return false;
  }

  const mappedIpv4 = mappedIpv4Address(normalized);

  if (mappedIpv4) {
    return isPublicIpv4(mappedIpv4);
  }

  if (
    normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('ff')
  ) {
    return false;
  }

  const first = Number.parseInt(normalized.slice(0, 4), 16);

  if (
    Number.isFinite(first)
    && first >= 0xfe80
    && first <= 0xfeff
  ) {
    return false;
  }

  if (normalized.startsWith('2001:db8:')) {
    return false;
  }

  return true;
}

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? isPublicIpv4(address) : family === 6 ? isPublicIpv6(address) : false;
}

function normalizedHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/gu, '').toLowerCase();
}

function assertSafeHostname(hostname: string): void {
  const normalized = normalizedHostname(hostname);
  if (
    normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
  ) {
    throw new UnsafeNetworkTargetError();
  }
}

export async function resolvePublicAddresses(
  hostname: string,
  hostLookup: HostLookup = systemHostLookup,
): Promise<readonly ResolvedAddress[]> {
  assertSafeHostname(hostname);
  const normalized = normalizedHostname(hostname);
  const literalFamily = isIP(normalized);
  const addresses = literalFamily
    ? [{ address: normalized, family: literalFamily }]
    : await hostLookup(normalized);
  if (addresses.length === 0) {
    throw new Error('Network target did not resolve');
  }

  if (addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new UnsafeNetworkTargetError();
  }

  return addresses;
}

export async function assertSafeHttpsUrl(
  url: URL,
  hostLookup: HostLookup = systemHostLookup,
): Promise<void> {
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
    throw new UnsafeNetworkTargetError();
  }
  await resolvePublicAddresses(url.hostname, hostLookup);
}
