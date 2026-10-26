import { describe, expect, it } from 'vitest';

import type { ApplicationProbeResult, ApplicationProbeSsl } from '@/api/applicationProbe';

import {
  CERTIFICATE_WARNING_DAYS,
  formatLatency,
  probeErrorLabel,
  probeHeadline,
  probeRequestErrorMessage,
  probeSslSummary,
} from './applicationProbe';

const validSsl: ApplicationProbeSsl = {
  daysRemaining: 60,
  enabled: true,
  errorCode: null,
  issuer: 'Test CA',
  protocol: 'TLSv1.3',
  valid: true,
  validFrom: '2036-01-01T00:00:00.000Z',
  validTo: '2036-04-01T00:00:00.000Z',
};

const noTls: ApplicationProbeSsl = {
  daysRemaining: null,
  enabled: false,
  errorCode: null,
  issuer: null,
  protocol: null,
  valid: null,
  validFrom: null,
  validTo: null,
};

function result(overrides: Partial<ApplicationProbeResult> = {}): ApplicationProbeResult {
  return {
    checkedAt: '2036-02-03T04:05:06.000Z',
    error: null,
    latencyMs: 143,
    online: true,
    redirectCount: 0,
    ssl: validSsl,
    statusCode: 200,
    title: 'Example',
    ...overrides,
  };
}

describe('formatLatency', () => {
  it('formats milliseconds and seconds, and tolerates null', () => {
    expect(formatLatency(143)).toBe('143 ms');
    expect(formatLatency(999)).toBe('999 ms');
    expect(formatLatency(1500)).toBe('1.5 s');
    expect(formatLatency(null)).toBeNull();
  });
});

describe('probeHeadline', () => {
  it('reports a healthy response', () => {
    expect(probeHeadline(result())).toEqual({ detail: '143 ms', label: '200 Online', tone: 'ok' });
  });

  it('treats 4xx as a warning and 5xx as an error', () => {
    expect(probeHeadline(result({ statusCode: 404 }))).toMatchObject({ label: '404 Responded', tone: 'warn' });
    expect(probeHeadline(result({ statusCode: 503, online: false }))).toMatchObject({ label: '503 Server error', tone: 'error' });
  });

  it('maps every failure code to a fixed label', () => {
    for (const code of ['HOST_UNREACHABLE', 'CONNECTION_FAILED', 'TIMEOUT', 'TLS_ERROR', 'REDIRECT_BLOCKED', 'TOO_MANY_REDIRECTS', 'UNEXPECTED'] as const) {
      const headline = probeHeadline(result({ error: code, latencyMs: null, online: false, statusCode: null }));
      expect(headline).toEqual({ detail: null, label: probeErrorLabel(code), tone: 'error' });
    }
  });

  it('never invents a status when none was returned', () => {
    expect(probeHeadline(result({ statusCode: null, error: null }))).toMatchObject({ label: 'No response', tone: 'error' });
  });
});

describe('probeSslSummary', () => {
  it('reports a valid certificate with days remaining', () => {
    expect(probeSslSummary(validSsl)).toEqual({ detail: 'Test CA', label: 'Valid · 60 days left', tone: 'ok' });
  });

  it('warns when the certificate is close to expiry', () => {
    expect(probeSslSummary({ ...validSsl, daysRemaining: CERTIFICATE_WARNING_DAYS })).toMatchObject({ tone: 'warn' });
    expect(probeSslSummary({ ...validSsl, daysRemaining: CERTIFICATE_WARNING_DAYS + 1 })).toMatchObject({ tone: 'ok' });
    expect(probeSslSummary({ ...validSsl, daysRemaining: 1 }).label).toBe('Valid · 1 day left');
  });

  it('reports an already expired certificate as an error', () => {
    expect(probeSslSummary({ ...validSsl, daysRemaining: -3 })).toMatchObject({ label: 'Certificate expired', tone: 'error' });
  });

  it('describes certificate failures without raw TLS text', () => {
    expect(probeSslSummary({ ...noTls, enabled: true, errorCode: 'CERT_EXPIRED', valid: false })).toMatchObject({ label: 'Certificate expired', tone: 'error' });
    expect(probeSslSummary({ ...noTls, enabled: true, errorCode: 'CERT_HOSTNAME_MISMATCH', valid: false }).label).toBe('Certificate does not match the hostname');
  });

  it('flags plain HTTP and unchecked TLS', () => {
    expect(probeSslSummary(noTls)).toEqual({ detail: null, label: 'No TLS (http)', tone: 'warn' });
    expect(probeSslSummary({ ...noTls, enabled: true })).toMatchObject({ label: 'TLS not checked', tone: 'neutral' });
  });
});

describe('probeRequestErrorMessage', () => {
  it('surfaces the server message and falls back for unknown failures', () => {
    expect(probeRequestErrorMessage(new Error('This destination cannot be probed.'))).toBe('This destination cannot be probed.');
    expect(probeRequestErrorMessage(new Error('   '))).toBe('The probe could not be started.');
    expect(probeRequestErrorMessage('boom')).toBe('The probe could not be started.');
  });
});
