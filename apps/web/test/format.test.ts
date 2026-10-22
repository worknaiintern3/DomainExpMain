import { afterEach, describe, expect, it } from 'vitest';

import {
  configureFormatting,
  formatDate,
  formatDateTime,
  formatTime,
  type DateFormatPattern,
} from '@/lib/format';

// 2026-10-24 22:30 UTC is already 25 Oct 04:00 in Asia/Kolkata (+05:30).
const INSTANT = '2026-10-24T22:30:00.000Z';

function use(dateFormat: DateFormatPattern, timeZone: string) {
  configureFormatting({ dateFormat, timeZone });
}

describe('settings-driven date formatting', () => {
  afterEach(() => use('DD MMM YYYY', 'Asia/Kolkata'));

  it('renders every supported date format', () => {
    use('DD MMM YYYY', 'UTC');
    expect(formatDate(INSTANT)).toBe('24 Oct 2026');
    use('YYYY-MM-DD', 'UTC');
    expect(formatDate(INSTANT)).toBe('2026-10-24');
    use('MM/DD/YYYY', 'UTC');
    expect(formatDate(INSTANT)).toBe('10/24/2026');
    use('DD/MM/YYYY', 'UTC');
    expect(formatDate(INSTANT)).toBe('24/10/2026');
  });

  it('applies the configured timezone, including across the date line', () => {
    use('DD MMM YYYY', 'Asia/Kolkata');
    expect(formatDateTime(INSTANT)).toBe('25 Oct 2026, 04:00');
    expect(formatTime(INSTANT)).toBe('04:00');
    use('DD MMM YYYY', 'America/Los_Angeles');
    expect(formatDateTime(INSTANT)).toBe('24 Oct 2026, 15:30');
  });

  it('returns the fallback for missing or invalid values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('', 'Unknown')).toBe('Unknown');
    expect(formatDateTime('not-a-date', 'Not scheduled')).toBe('Not scheduled');
  });

  it('falls back to a safe timezone instead of throwing on an unknown zone', () => {
    use('DD MMM YYYY', 'Not/AZone');
    expect(formatDate(INSTANT)).toBe('25 Oct 2026');
  });
});
