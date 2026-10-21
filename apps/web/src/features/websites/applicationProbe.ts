import type {
  ApplicationProbeErrorCode,
  ApplicationProbeResult,
  ApplicationProbeSsl,
  ApplicationProbeSslErrorCode,
} from '@/api/applicationProbe';

export type ProbeTone = 'ok' | 'warn' | 'error' | 'neutral';

/** Days of certificate validity below which the probe flags a warning. */
export const CERTIFICATE_WARNING_DAYS = 14;

const ERROR_LABELS: Record<ApplicationProbeErrorCode, string> = {
  CONNECTION_FAILED: 'Connection failed',
  HOST_UNREACHABLE: 'Host unreachable',
  REDIRECT_BLOCKED: 'Redirect blocked',
  TIMEOUT: 'Timed out',
  TLS_ERROR: 'TLS error',
  TOO_MANY_REDIRECTS: 'Too many redirects',
  UNEXPECTED: 'Probe failed',
};

const SSL_ERROR_LABELS: Record<ApplicationProbeSslErrorCode, string> = {
  CERT_EXPIRED: 'Certificate expired',
  CERT_HOSTNAME_MISMATCH: 'Certificate does not match the hostname',
  CERT_NOT_YET_VALID: 'Certificate not yet valid',
  CERT_UNTRUSTED: 'Certificate not trusted',
  TLS_HANDSHAKE_FAILED: 'TLS handshake failed',
};

export function probeErrorLabel(code: ApplicationProbeErrorCode): string {
  return ERROR_LABELS[code];
}

export function formatLatency(latencyMs: number | null): string | null {
  if (latencyMs === null) return null;
  return latencyMs >= 1000 ? `${(latencyMs / 1000).toFixed(1)} s` : `${latencyMs} ms`;
}

export interface ProbeHeadline {
  detail: string | null;
  label: string;
  tone: ProbeTone;
}

/** One-line outcome for a probe: what happened, and how worried to look. */
export function probeHeadline(result: ApplicationProbeResult): ProbeHeadline {
  if (result.error !== null) {
    return { detail: null, label: probeErrorLabel(result.error), tone: 'error' };
  }
  const status = result.statusCode;
  if (status === null) return { detail: null, label: 'No response', tone: 'error' };
  const latency = formatLatency(result.latencyMs);
  if (status >= 500) return { detail: latency, label: `${status} Server error`, tone: 'error' };
  if (status >= 400) return { detail: latency, label: `${status} Responded`, tone: 'warn' };
  return { detail: latency, label: `${status} Online`, tone: 'ok' };
}

export interface ProbeSslSummary {
  detail: string | null;
  label: string;
  tone: ProbeTone;
}

/** Certificate outcome for a probe, including an expiry warning. */
export function probeSslSummary(ssl: ApplicationProbeSsl): ProbeSslSummary {
  if (!ssl.enabled) return { detail: null, label: 'No TLS (http)', tone: 'warn' };
  if (ssl.errorCode !== null) {
    return { detail: null, label: SSL_ERROR_LABELS[ssl.errorCode], tone: 'error' };
  }
  if (ssl.valid !== true) return { detail: null, label: 'TLS not checked', tone: 'neutral' };
  const days = ssl.daysRemaining;
  if (days === null) return { detail: ssl.issuer, label: 'Certificate valid', tone: 'ok' };
  if (days < 0) return { detail: ssl.issuer, label: 'Certificate expired', tone: 'error' };
  const remaining = days === 1 ? '1 day left' : `${days} days left`;
  return {
    detail: ssl.issuer,
    label: `Valid · ${remaining}`,
    tone: days <= CERTIFICATE_WARNING_DAYS ? 'warn' : 'ok',
  };
}

export const PROBE_TONE_CLASSES: Record<ProbeTone, string> = {
  error: 'border-error-container bg-error-container/40 text-on-error-container',
  neutral: 'border-outline-variant/40 bg-surface-container text-secondary',
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-900',
};

/** Message for a probe request that itself failed (400, 401, network). */
export function probeRequestErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return 'The probe could not be started.';
}
