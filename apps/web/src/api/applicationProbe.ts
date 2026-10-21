import { apiRequest } from './client';

export type ApplicationProbeErrorCode =
  | 'HOST_UNREACHABLE'
  | 'CONNECTION_FAILED'
  | 'TIMEOUT'
  | 'TLS_ERROR'
  | 'REDIRECT_BLOCKED'
  | 'TOO_MANY_REDIRECTS'
  | 'UNEXPECTED';

export type ApplicationProbeSslErrorCode =
  | 'CERT_EXPIRED'
  | 'CERT_NOT_YET_VALID'
  | 'CERT_UNTRUSTED'
  | 'CERT_HOSTNAME_MISMATCH'
  | 'TLS_HANDSHAKE_FAILED';

export interface ApplicationProbeSsl {
  daysRemaining: number | null;
  enabled: boolean;
  errorCode: ApplicationProbeSslErrorCode | null;
  issuer: string | null;
  protocol: string | null;
  valid: boolean | null;
  validFrom: string | null;
  validTo: string | null;
}

/** Mirrors ApplicationProbeResponse in @domainpulse/contracts. */
export interface ApplicationProbeResult {
  checkedAt: string;
  error: ApplicationProbeErrorCode | null;
  latencyMs: number | null;
  online: boolean;
  redirectCount: number;
  ssl: ApplicationProbeSsl;
  statusCode: number | null;
  title: string | null;
}

type BackendProbeResult = {
  online: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  title: string | null;
  ssl: boolean;
  error: string | null;
};

/** The current backend exposes a GET probe; never put URL credentials in its query string. */
export async function probeApplicationUrl(
  url: string,
  signal?: AbortSignal,
): Promise<ApplicationProbeResult> {
  const target = new URL(url);
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error('Live check supports HTTP and HTTPS URLs only.');
  }
  if (target.username || target.password || target.search || target.hash) {
    throw new Error('Live check cannot send URLs containing credentials, query parameters, or fragments to this backend.');
  }
  const result = await apiRequest<BackendProbeResult>(`/applications/probe?url=${encodeURIComponent(target.toString())}`, {
    ...(signal ? { signal } : {}),
  });
  return {
    checkedAt: new Date().toISOString(),
    error: result.error ? 'UNEXPECTED' : null,
    latencyMs: result.latencyMs,
    online: result.online,
    redirectCount: 0,
    ssl: {
      daysRemaining: null,
      enabled: result.ssl,
      errorCode: null,
      issuer: null,
      protocol: null,
      valid: null,
      validFrom: null,
      validTo: null,
    },
    statusCode: result.statusCode,
    title: result.title,
  };
}
