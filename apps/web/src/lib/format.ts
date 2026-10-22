/**
 * Date and time formatting driven by the user's General settings
 * (date format and timezone). The active preferences live in a
 * module-level value that PreferencesProvider updates whenever settings load
 * or are saved, so plain helper functions (not just components) can format
 * consistently without threading props through every call site.
 */
export type DateFormatPattern = 'DD MMM YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY';

export interface FormatPreferences {
  dateFormat: DateFormatPattern;
  timeZone: string;
}

const DEFAULT_PREFERENCES: FormatPreferences = {
  dateFormat: 'DD MMM YYYY',
  timeZone: 'Asia/Kolkata',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let active: FormatPreferences = DEFAULT_PREFERENCES;

export function configureFormatting(preferences: FormatPreferences): void {
  active = preferences;
}

export function getFormatting(): FormatPreferences {
  return active;
}

interface Parts {
  day: string;
  hour: string;
  minute: string;
  month: number;
  year: string;
}

function toParts(value: string | number | Date, timeZone: string): Parts | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      month: '2-digit',
      timeZone,
      year: 'numeric',
    });
  } catch {
    return toParts(date, DEFAULT_PREFERENCES.timeZone);
  }

  const lookup = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return {
    day: lookup['day'] ?? '',
    hour: lookup['hour'] ?? '',
    minute: lookup['minute'] ?? '',
    month: Number(lookup['month'] ?? '1'),
    year: lookup['year'] ?? '',
  };
}

function composeDate(parts: Parts, pattern: DateFormatPattern): string {
  const month = String(parts.month).padStart(2, '0');
  switch (pattern) {
    case 'YYYY-MM-DD':
      return `${parts.year}-${month}-${parts.day}`;
    case 'MM/DD/YYYY':
      return `${month}/${parts.day}/${parts.year}`;
    case 'DD/MM/YYYY':
      return `${parts.day}/${month}/${parts.year}`;
    case 'DD MMM YYYY':
    default:
      return `${parts.day} ${MONTHS[parts.month - 1] ?? month} ${parts.year}`;
  }
}

/** Date only, in the configured format and timezone. Returns `empty` for missing or invalid input. */
export function formatDate(
  value: string | number | Date | null | undefined,
  empty = '—',
): string {
  if (value === null || value === undefined || value === '') return empty;
  const parts = toParts(value, active.timeZone);
  return parts ? composeDate(parts, active.dateFormat) : empty;
}

/** Date plus 24-hour time (HH:mm), in the configured format and timezone. */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  empty = '—',
): string {
  if (value === null || value === undefined || value === '') return empty;
  const parts = toParts(value, active.timeZone);
  return parts
    ? `${composeDate(parts, active.dateFormat)}, ${parts.hour}:${parts.minute}`
    : empty;
}

/** Time only (HH:mm), in the configured timezone. */
export function formatTime(
  value: string | number | Date | null | undefined,
  empty = '—',
): string {
  if (value === null || value === undefined || value === '') return empty;
  const parts = toParts(value, active.timeZone);
  return parts ? `${parts.hour}:${parts.minute}` : empty;
}
