export const TLS_ERROR_CODES = [
  'TLS_DNS_LOOKUP_FAILED',
  'TLS_UNSAFE_ADDRESS',
  'TLS_CONNECT_TIMEOUT',
  'TLS_CONNECTION_FAILED',
  'TLS_NO_CERTIFICATE',
  'TLS_CERTIFICATE_INVALID',
  'TLS_RESPONSE_INVALID',
] as const;

export type TlsErrorCode = typeof TLS_ERROR_CODES[number];

export class TlsInspectionError extends Error {
  constructor(readonly code: TlsErrorCode) {
    super(code);
    this.name = 'TlsInspectionError';
  }
}
