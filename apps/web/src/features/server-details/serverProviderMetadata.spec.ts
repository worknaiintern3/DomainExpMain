import { describe, expect, it } from 'vitest';

import {
  formatCpu,
  formatDisk,
  formatMemory,
  formatProviderCreatedAt,
  formatProviderStatus,
  formatSpecsCompact,
  operatingSystemDetailEntries,
} from './serverProviderMetadata';

describe('formatCpu / formatMemory / formatDisk', () => {
  it('formats present values with normalized units', () => {
    expect(formatCpu(2)).toBe('2 vCPU');
    expect(formatMemory(2_048)).toBe('2 GB RAM');
    expect(formatDisk(50)).toBe('50 GB disk');
  });

  it('rounds fractional GB to one decimal place', () => {
    expect(formatMemory(1_536)).toBe('1.5 GB RAM');
    expect(formatDisk(81.333)).toBe('81.3 GB disk');
  });

  it('returns null (never a fabricated value) when the provider did not report the field', () => {
    expect(formatCpu(null)).toBeNull();
    expect(formatMemory(null)).toBeNull();
    expect(formatDisk(null)).toBeNull();
    expect(formatCpu(undefined)).toBeNull();
  });
});

describe('formatSpecsCompact', () => {
  it('joins only the parts that were actually reported', () => {
    expect(formatSpecsCompact({ cpuCount: 2, diskGb: 50, memoryMb: 2_048 })).toBe(
      '2 vCPU · 2 GB RAM · 50 GB disk',
    );
    expect(formatSpecsCompact({ cpuCount: 4, diskGb: null, memoryMb: null })).toBe('4 vCPU');
  });

  it('falls back to "Not reported" when no spec, or no specs object, is available', () => {
    expect(formatSpecsCompact({ cpuCount: null, diskGb: null, memoryMb: null })).toBe('Not reported');
    expect(formatSpecsCompact(null)).toBe('Not reported');
    expect(formatSpecsCompact(undefined)).toBe('Not reported');
  });
});

describe('formatProviderStatus / formatProviderCreatedAt', () => {
  it('passes through a real value untouched', () => {
    expect(formatProviderStatus('active')).toBe('active');
  });

  it('renders a real ISO date using the locale date format', () => {
    expect(formatProviderCreatedAt('2026-01-01T00:00:00Z')).not.toBe('Not reported');
  });

  it('falls back to "Not reported" for null/blank/missing values', () => {
    expect(formatProviderStatus(null)).toBe('Not reported');
    expect(formatProviderStatus('')).toBe('Not reported');
    expect(formatProviderCreatedAt(null)).toBe('Not reported');
    expect(formatProviderCreatedAt(undefined)).toBe('Not reported');
  });

  it('falls back to the raw string for an unparseable date rather than hiding it', () => {
    expect(formatProviderCreatedAt('not-a-real-date')).toBe('not-a-real-date');
  });
});

describe('operatingSystemDetailEntries', () => {
  it('humanizes camelCase keys into readable labels', () => {
    expect(operatingSystemDetailEntries({ distribution: 'Ubuntu', osFlavor: 'ubuntu' })).toEqual([
      ['Distribution', 'Ubuntu'],
      ['Os flavor', 'ubuntu'],
    ]);
  });

  it('returns an empty list (renders nothing) when no detail is present', () => {
    expect(operatingSystemDetailEntries(null)).toEqual([]);
    expect(operatingSystemDetailEntries(undefined)).toEqual([]);
  });
});
