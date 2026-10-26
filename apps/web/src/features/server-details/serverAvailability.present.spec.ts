import { describe, expect, it } from 'vitest';

import { failureLabel, formatLatency, observedStatus, runStatusLabel, statusVariant } from './serverAvailability.present';

describe('server availability presentation', () => {
  it('maps observations without treating worker errors or pending work as DOWN', () => {
    expect(observedStatus('AVAILABLE')).toBe('UP');
    expect(observedStatus('UNAVAILABLE')).toBe('DOWN');
    expect(observedStatus('ERROR')).toBe('UNKNOWN');
    expect(observedStatus(null)).toBe('UNKNOWN');
    expect(observedStatus('QUEUED')).toBe('UNKNOWN');
    expect(observedStatus('RUNNING')).toBe('UNKNOWN');
    expect(runStatusLabel('ERROR')).toBe('UNKNOWN');
    expect(runStatusLabel('RUNNING')).toBe('Running');
    expect(statusVariant('UNKNOWN')).toBe('neutral');
  });

  it('does not fabricate latency or a successful failure reason', () => {
    expect(formatLatency(null)).toBe('Not recorded');
    expect(formatLatency(0)).toBe('0 ms');
    expect(failureLabel(null)).toBe('None');
    expect(failureLabel('WORKER_LEASE_EXPIRED')).toContain('unknown');
  });
});
