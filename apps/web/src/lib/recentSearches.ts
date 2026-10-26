/**
 * Recent Find Domain searches, kept in this browser only (a UI convenience,
 * never credentials). Controlled by the "Save search history" Discovery setting.
 */
const STORAGE_KEY = 'domainpulse.recent-searches';
const MAX_ENTRIES = 8;
export const RECENT_SEARCHES_CHANGED_EVENT = 'domainpulse:recent-searches-changed';

function notifyChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(RECENT_SEARCHES_CHANGED_EVENT));
  }
}

export function readRecentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string').slice(0, MAX_ENTRIES)
      : [];
  } catch {
    return [];
  }
}

function write(entries: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    notifyChanged();
  } catch {
    // Blocked storage just means history is not remembered.
  }
}

/** Adds a search to the front (de-duplicated, case-insensitive) and returns the new list. */
export function addRecentSearch(term: string): string[] {
  const trimmed = term.trim().toLowerCase();
  if (trimmed === '') return readRecentSearches();
  const next = [trimmed, ...readRecentSearches().filter((entry) => entry !== trimmed)].slice(0, MAX_ENTRIES);
  write(next);
  return next;
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    notifyChanged();
  } catch {
    // ignore
  }
}
