import { connect, type ConnectionOptions, type PeerCertificate } from 'node:tls';

import type { HostLookup } from '../network/public-network';
import {
  resolvePublicAddresses,
  systemHostLookup,
  UnsafeNetworkTargetError,
} from '../network/public-network';
import { TlsInspectionError } from './tls.errors';

const DEFAULT_TIMEOUT_MS = 8_000;

export interface TlsSnapshot {
  readonly fingerprint256: string | null;
  readonly issuerCommonName: string | null;
  readonly issuerOrganization: string | null;
  readonly serialNumber: string | null;
  readonly subjectAltNames: readonly string[];
  readonly subjectCommonName: string | null;
  readonly validFrom: Date;
  readonly validTo: Date;
}

export interface TlsSocketLike {
  destroy(): void;
  getPeerCertificate(): PeerCertificate;
  once(event: 'error', listener: (error: Error) => void): this;
  once(event: 'secureConnect' | 'timeout', listener: () => void): this;
  setTimeout(timeout: number): this;
}

export type TlsConnector = (options: ConnectionOptions) => TlsSocketLike;

export interface TlsClientOptions {
  readonly connector?: TlsConnector;
  readonly hostLookup?: HostLookup;
  readonly timeoutMs?: number;
}

const systemConnector: TlsConnector = (options) => connect(options);

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function certificateNames(subjectAltName: string | undefined): string[] {
  if (!subjectAltName) return [];
  const names: string[] = [];
  const pattern = /(?:^|,\s*)DNS:([^,]+)/gu;
  for (const match of subjectAltName.matchAll(pattern)) {
    const name = match[1]?.trim().toLowerCase().replace(/\.$/u, '');
    if (name) names.push(name);
  }
  return [...new Set(names)].sort();
}

export function normalizeTlsCertificate(certificate: PeerCertificate): TlsSnapshot {
  if (Object.keys(certificate).length === 0) throw new TlsInspectionError('TLS_NO_CERTIFICATE');
  const validFrom = new Date(certificate.valid_from);
  const validTo = new Date(certificate.valid_to);
  if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validTo.getTime())) {
    throw new TlsInspectionError('TLS_RESPONSE_INVALID');
  }
  if (validTo <= validFrom) throw new TlsInspectionError('TLS_CERTIFICATE_INVALID');
  return {
    fingerprint256: clean(certificate.fingerprint256)?.toUpperCase() ?? null,
    issuerCommonName: clean(certificate.issuer.CN),
    issuerOrganization: clean(certificate.issuer.O),
    serialNumber: clean(certificate.serialNumber)?.toUpperCase() ?? null,
    subjectAltNames: certificateNames(certificate.subjectaltname),
    subjectCommonName: clean(certificate.subject.CN)?.toLowerCase() ?? null,
    validFrom,
    validTo,
  };
}

export class TlsClient {
  private readonly connector: TlsConnector;
  private readonly hostLookup: HostLookup;
  private readonly timeoutMs: number;

  constructor(options: TlsClientOptions = {}) {
    this.connector = options.connector ?? systemConnector;
    this.hostLookup = options.hostLookup ?? systemHostLookup;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async retrieve(domain: string): Promise<TlsSnapshot> {
    let addresses;
    try {
      addresses = await resolvePublicAddresses(domain, this.hostLookup);
    } catch (error) {
      throw new TlsInspectionError(
        error instanceof UnsafeNetworkTargetError ? 'TLS_UNSAFE_ADDRESS' : 'TLS_DNS_LOOKUP_FAILED',
      );
    }
    const target = addresses[0];
    if (!target) throw new TlsInspectionError('TLS_DNS_LOOKUP_FAILED');

    return await new Promise<TlsSnapshot>((resolve, reject) => {
      let socket: TlsSocketLike;
      let settled = false;
      const finish = (result: TlsSnapshot | TlsInspectionError) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (result instanceof TlsInspectionError) reject(result);
        else resolve(result);
      };
      try {
        socket = this.connector({
          host: target.address,
          port: 443,
          rejectUnauthorized: true,
          servername: domain,
        });
      } catch {
        reject(new TlsInspectionError('TLS_CONNECTION_FAILED'));
        return;
      }
      socket.setTimeout(this.timeoutMs);
      socket.once('timeout', () => {
        finish(new TlsInspectionError('TLS_CONNECT_TIMEOUT'));
      });
      socket.once('error', () => {
        finish(new TlsInspectionError('TLS_CONNECTION_FAILED'));
      });
      socket.once('secureConnect', () => {
        try {
          finish(normalizeTlsCertificate(socket.getPeerCertificate()));
        } catch (error) {
          finish(error instanceof TlsInspectionError ? error : new TlsInspectionError('TLS_RESPONSE_INVALID'));
        }
      });
    });
  }
}
