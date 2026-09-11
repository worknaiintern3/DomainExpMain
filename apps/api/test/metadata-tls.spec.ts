/* eslint-disable @typescript-eslint/require-await */
import type { PeerCertificate } from 'node:tls';

import { describe, expect, it, vi } from 'vitest';

import {
  normalizeTlsCertificate,
  TlsClient,
  type TlsSocketLike,
} from '../src/metadata/tls/tls.client';

const certificate = {
  fingerprint256: 'aa:bb:cc',
  issuer: { CN: 'Example CA', O: 'Example Trust' },
  serialNumber: '00ab12',
  subject: { CN: 'EXAMPLE.COM' },
  subjectaltname: 'DNS:EXAMPLE.COM, DNS:www.example.com, DNS:example.com',
  valid_from: 'Jan  1 00:00:00 2026 GMT',
  valid_to: 'Jan  1 00:00:00 2027 GMT',
} as PeerCertificate;

interface FakeSocketControl {
  readonly destroy: ReturnType<typeof vi.fn>;
  emit(event: 'error' | 'secureConnect' | 'timeout'): void;
  readonly socket: TlsSocketLike;
}

function fakeSocket(peerCertificate: PeerCertificate = certificate): FakeSocketControl {
  const listeners = new Map<string, (...args: never[]) => void>();
  const emitted = new Set<string>();
  const destroy = vi.fn();
  const socket = {
    destroy,
    getPeerCertificate: vi.fn(() => peerCertificate),
    once: vi.fn((event: string, listener: (...args: never[]) => void) => {
      listeners.set(event, listener);
      if (emitted.has(event)) queueMicrotask(listener);
      return socket;
    }),
    setTimeout: vi.fn(() => socket),
  } as unknown as TlsSocketLike;
  return {
    destroy,
    emit: (event) => {
      const listener = listeners.get(event);
      if (listener) listener();
      else emitted.add(event);
    },
    socket,
  };
}

const safeLookup = async () => [{ address: '93.184.216.34', family: 4 }];

describe('TLS certificate inspection', () => {
  it('normalizes certificate names, issuer, dates, serial, and SHA-256 fingerprint', () => {
    expect(normalizeTlsCertificate(certificate)).toEqual({
      fingerprint256: 'AA:BB:CC',
      issuerCommonName: 'Example CA',
      issuerOrganization: 'Example Trust',
      serialNumber: '00AB12',
      subjectAltNames: ['example.com', 'www.example.com'],
      subjectCommonName: 'example.com',
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      validTo: new Date('2027-01-01T00:00:00.000Z'),
    });
  });

  it('rejects private targets before opening a TLS socket', async () => {
    const connector = vi.fn();
    const client = new TlsClient({
      connector,
      hostLookup: async () => [{ address: '127.0.0.1', family: 4 }],
    });
    await expect(client.retrieve('example.com')).rejects.toMatchObject({ code: 'TLS_UNSAFE_ADDRESS' });
    expect(connector).not.toHaveBeenCalled();
  });

  it('maps DNS failures safely before opening a socket', async () => {
    const connector = vi.fn();
    const client = new TlsClient({
      connector,
      hostLookup: async () => { throw new Error('private resolver detail'); },
    });
    await expect(client.retrieve('example.com')).rejects.toMatchObject({ code: 'TLS_DNS_LOOKUP_FAILED' });
    expect(connector).not.toHaveBeenCalled();
  });

  it.each([
    ['timeout', 'TLS_CONNECT_TIMEOUT'],
    ['error', 'TLS_CONNECTION_FAILED'],
  ] as const)('maps %s and always destroys the socket', async (event, code) => {
    const fake = fakeSocket();
    const client = new TlsClient({ connector: () => fake.socket, hostLookup: safeLookup });
    const retrieval = client.retrieve('example.com');
    await Promise.resolve();
    fake.emit(event);
    await expect(retrieval).rejects.toMatchObject({ code });
    expect(fake.destroy).toHaveBeenCalledOnce();
  });

  it('returns normalized data after secure connect and cleans up the socket', async () => {
    const fake = fakeSocket();
    const connector = vi.fn(() => fake.socket);
    const client = new TlsClient({ connector, hostLookup: safeLookup });
    const retrieval = client.retrieve('example.com');
    await Promise.resolve();
    fake.emit('secureConnect');
    await expect(retrieval).resolves.toMatchObject({ subjectCommonName: 'example.com' });
    expect(connector).toHaveBeenCalledWith(expect.objectContaining({
      host: '93.184.216.34',
      port: 443,
      rejectUnauthorized: true,
      servername: 'example.com',
    }));
    expect(fake.destroy).toHaveBeenCalledOnce();
  });

  it('maps a missing certificate and still cleans up', async () => {
    const fake = fakeSocket({} as PeerCertificate);
    const client = new TlsClient({ connector: () => fake.socket, hostLookup: safeLookup });
    const retrieval = client.retrieve('example.com');
    await Promise.resolve();
    fake.emit('secureConnect');
    await expect(retrieval).rejects.toMatchObject({ code: 'TLS_NO_CERTIFICATE' });
    expect(fake.destroy).toHaveBeenCalledOnce();
  });
});
