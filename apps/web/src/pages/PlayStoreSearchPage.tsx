/**
 * Play Store search page.
 *
 * Searches the public Google Play catalogue by developer name or ID and shows
 * the apps that developer publishes. The backend endpoints under
 * `/api/v1/play-store/*` are public, so nothing here needs a Google account.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import { createInventory, listInventory } from '@/api/inventory';
import {
  getPlayStoreDeveloperApps,
  searchPlayStoreDevelopers,
  type DeveloperAppsResponse,
  type DeveloperSearchResult,
  type PlayStoreAppItem,
} from '@/api/play-store';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

interface SearchResult {
  developers: DeveloperSearchResult[];
  query: string;
  total: number;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.detail || error.title || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function DeveloperAvatar({
  developer,
}: {
  developer: DeveloperSearchResult;
}): React.ReactElement {
  if (developer.icon) {
    return (
      <img
        alt=""
        className="h-10 w-10 shrink-0 rounded-lg border border-outline-variant/30 object-cover"
        src={developer.icon}
      />
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container text-secondary">
      <span className="material-symbols-outlined text-[20px]">storefront</span>
    </span>
  );
}

function AppIcon({ app }: { app: PlayStoreAppItem }): React.ReactElement {
  if (app.iconUrl) {
    return (
      <img
        alt=""
        className="h-11 w-11 shrink-0 rounded-lg border border-outline-variant/30 object-cover"
        src={app.iconUrl}
      />
    );
  }
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container text-secondary">
      <span className="material-symbols-outlined text-[20px]">android</span>
    </span>
  );
}

export const PlayStoreSearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<LoadState>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);

  const [selectedDeveloper, setSelectedDeveloper] = useState<DeveloperSearchResult | null>(null);
  const [appsState, setAppsState] = useState<LoadState>('idle');
  const [appsError, setAppsError] = useState<string | null>(null);
  const [appsResult, setAppsResult] = useState<DeveloperAppsResponse | null>(null);

  const searchRequestRef = useRef(0);
  const appsRequestRef = useRef(0);
  const lastSearchedQueryRef = useRef('');
  const [submitTick, setSubmitTick] = useState(0);
  const [trackedPackageIds, setTrackedPackageIds] = useState<Set<string>>(() => new Set());
  const [trackingPackageId, setTrackingPackageId] = useState<string | null>(null);
  const [trackNotice, setTrackNotice] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void listInventory('applications', { includeArchived: true, limit: 100, signal: controller.signal })
      .then((page) => {
        const ids = new Set<string>();
        for (const application of page.items) {
          if (!application.primaryUrl) continue;
          try {
            const id = new URL(application.primaryUrl).searchParams.get('id');
            if (id) ids.add(id);
          } catch {
            // Ignore malformed stored URLs; they cannot be matched to Play packages.
          }
        }
        setTrackedPackageIds(ids);
      })
      .catch(() => {
        // Tracking is still available even if the existing inventory cannot be read.
      });
    return () => controller.abort();
  }, []);

  const trackApp = async (app: PlayStoreAppItem) => {
    if (trackingPackageId) return;
    setTrackingPackageId(app.packageId);
    setTrackNotice(null);
    try {
      await createInventory('applications', {
        kind: 'MOBILE_APPLICATION',
        name: app.name,
        notes: `Tracked from Play Store${selectedDeveloper ? ` · ${selectedDeveloper.name}` : ''} (${app.packageId})`,
        primaryUrl: app.playStoreUrl,
      });
      setTrackedPackageIds((current) => new Set(current).add(app.packageId));
      setTrackNotice({ message: `${app.name} was added to Websites & Apps.`, tone: 'success' });
    } catch (error) {
      setTrackNotice({ message: toErrorMessage(error, 'The app could not be tracked.'), tone: 'error' });
    } finally {
      setTrackingPackageId(null);
    }
  };

  const clearSelection = useCallback(() => {
    appsRequestRef.current += 1;
    setSelectedDeveloper(null);
    setAppsState('idle');
    setAppsError(null);
    setAppsResult(null);
  }, []);

  const runSearch = useCallback(
    async (rawQuery: string) => {
      const normalized = rawQuery.trim();
      if (!normalized) return;

      lastSearchedQueryRef.current = normalized;
      const requestId = ++searchRequestRef.current;
      setSearchState('loading');
      setSearchError(null);

      try {
        const response = await searchPlayStoreDevelopers(normalized, 20);
        if (requestId !== searchRequestRef.current) return;
        setResult({
          developers: response.developers,
          query: response.query || normalized,
          total: response.total,
        });
        setSearchState('success');
        clearSelection();
      } catch (error) {
        if (requestId !== searchRequestRef.current) return;
        setSearchError(toErrorMessage(error, 'Developer search failed.'));
        setSearchState('error');
      }
    },
    [clearSelection],
  );

  // Debounced search-as-you-type. Submitting the form bumps `submitTick`, which
  // re-runs this effect so the pending debounce timer is cancelled.
  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) {
      searchRequestRef.current += 1;
      lastSearchedQueryRef.current = '';
      setResult(null);
      setSearchState('idle');
      setSearchError(null);
      clearSelection();
      return;
    }
    if (normalized === lastSearchedQueryRef.current) return;

    const timer = window.setTimeout(() => {
      void runSearch(normalized);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [clearSelection, query, runSearch, submitTick]);

  useEffect(
    () => () => {
      searchRequestRef.current += 1;
      appsRequestRef.current += 1;
    },
    [],
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) return;
    void runSearch(query);
    setSubmitTick((tick) => tick + 1);
  };

  const loadApps = useCallback(async (developer: DeveloperSearchResult) => {
    const requestId = ++appsRequestRef.current;
    setSelectedDeveloper(developer);
    setAppsState('loading');
    setAppsError(null);
    setAppsResult(null);
    try {
      const response = await getPlayStoreDeveloperApps(developer.id, 100);
      if (requestId !== appsRequestRef.current) return;
      setAppsResult(response);
      setAppsState('success');
    } catch (error) {
      if (requestId !== appsRequestRef.current) return;
      setAppsError(toErrorMessage(error, 'Apps could not be loaded for this developer.'));
      setAppsState('error');
    }
  }, []);

  const developers = result?.developers ?? [];
  const apps = appsResult?.apps ?? [];

  return (
    <div className="flex w-full flex-col gap-unit-lg pb-unit-2xl">
      <PageHeader
        badge={result ? `${result.total} developers` : undefined}
        description="Search any public Google Play developer by name or ID, then inspect the apps they publish. Track an app to add it to your inventory. This reads the public Play Store catalogue, so no Google account connection is required."
        title="Play Store Search"
      />

      {trackNotice && (
        <div
          className={`rounded-lg border p-unit-sm text-body-sm ${trackNotice.tone === 'success' ? 'border-primary/30 bg-primary/5 text-on-surface' : 'border-error/30 bg-error/5 text-error'}`}
          role={trackNotice.tone === 'success' ? 'status' : 'alert'}
        >
          {trackNotice.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-unit-lg lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-unit-lg">
          <section
            aria-labelledby="play-store-search-heading"
            className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-micro"
          >
            <h2
              className="font-headline-sm text-headline-sm font-semibold text-on-surface"
              id="play-store-search-heading"
            >
              Find a developer
            </h2>
            <form className="mt-unit-md flex flex-col gap-unit-sm" onSubmit={handleSubmit}>
              <label
                className="font-label-md text-label-md text-on-surface"
                htmlFor="play-store-query"
              >
                Developer name or ID
              </label>
              <div className="flex flex-col gap-unit-sm sm:flex-row">
                <SearchInput
                  id="play-store-query"
                  onChange={(event) => setQuery(event.target.value)}
                  onClear={() => setQuery('')}
                  placeholder="e.g. Google LLC"
                  showShortcut={false}
                  value={query}
                />
                <Button
                  className="shrink-0"
                  disabled={!query.trim() || searchState === 'loading'}
                  iconLeading="search"
                  type="submit"
                  variant="primary"
                >
                  {searchState === 'loading' ? 'Searching…' : 'Search'}
                </Button>
              </div>
              <p className="font-caption-xs text-caption-xs text-secondary">
                Results refresh automatically as you type. Press Enter to search immediately.
              </p>
            </form>
          </section>

          <section
            aria-labelledby="play-store-results-heading"
            className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-micro"
          >
            <div className="flex items-center justify-between gap-unit-sm">
              <h2
                className="font-headline-sm text-headline-sm font-semibold text-on-surface"
                id="play-store-results-heading"
              >
                Developers
              </h2>
              {result && (
                <span className="font-caption-xs text-caption-xs text-secondary">
                  {developers.length} shown
                </span>
              )}
            </div>

            {searchState === 'loading' && (
              <p className="mt-unit-md flex items-center gap-unit-xs font-body-sm text-body-sm text-secondary" role="status">
                <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                Searching the Play Store…
              </p>
            )}

            {searchState === 'error' && (
              <div className="mt-unit-md rounded-lg border border-error/30 bg-error/5 p-unit-sm" role="alert">
                <p className="font-label-md text-label-md font-semibold text-error">Search failed</p>
                <p className="mt-unit-2xs font-body-sm text-body-sm text-secondary">{searchError}</p>
                <Button
                  className="mt-unit-sm"
                  iconLeading="refresh"
                  onClick={() => void runSearch(query)}
                  size="sm"
                  variant="outline"
                >
                  Try again
                </Button>
              </div>
            )}

            {searchState === 'idle' && (
              <p className="mt-unit-md font-body-sm text-body-sm text-secondary">
                Start typing a developer name to see matches.
              </p>
            )}

            {searchState === 'success' && developers.length === 0 && (
              <p className="mt-unit-md font-body-sm text-body-sm text-secondary">
                No developers found for “{result?.query}”.
              </p>
            )}

            {developers.length > 0 && (
              <ul className="mt-unit-md flex flex-col gap-unit-2xs">
                {developers.map((developer) => {
                  const selected = selectedDeveloper?.id === developer.id;
                  return (
                    <li key={developer.id}>
                      <button
                        aria-pressed={selected}
                        className={`flex w-full items-start gap-unit-sm rounded-lg border p-unit-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                          selected
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-transparent hover:border-outline-variant/60 hover:bg-surface-container-low'
                        }`}
                        onClick={() => void loadApps(developer)}
                        type="button"
                      >
                        <DeveloperAvatar developer={developer} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-unit-2xs">
                            <span className="truncate font-body-sm text-body-sm font-medium text-on-surface">
                              {developer.name}
                            </span>
                            {developer.verified && (
                              <span
                                className="material-symbols-outlined text-[14px] text-primary"
                                title="Verified developer"
                              >
                                verified
                              </span>
                            )}
                          </span>
                          <span className="mt-unit-2xs block font-caption-xs text-caption-xs text-secondary">
                            {developer.appCount} {developer.appCount === 1 ? 'app' : 'apps'}
                          </span>
                          {developer.sampleApps.length > 0 && (
                            <span className="mt-unit-2xs block truncate font-caption-xs text-caption-xs text-outline">
                              {developer.sampleApps.slice(0, 3).join(' · ')}
                            </span>
                          )}
                        </span>
                        <span className="material-symbols-outlined shrink-0 text-[16px] text-secondary">
                          chevron_right
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section
          aria-label="Developer apps"
          className="min-w-0 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-micro"
        >
          {!selectedDeveloper ? (
            <div className="flex min-h-[18rem] flex-col items-center justify-center gap-unit-sm text-center">
              <span className="material-symbols-outlined text-[32px] text-outline">store</span>
              <p className="font-body-sm text-body-sm text-secondary">
                Select a developer to see their published apps.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-unit-md">
                <div className="flex min-w-0 items-center gap-unit-sm">
                  <DeveloperAvatar developer={selectedDeveloper} />
                  <div className="min-w-0">
                    <h2
                      className="truncate font-headline-sm text-headline-sm font-semibold text-on-surface"
                      id="play-store-apps-heading"
                    >
                      {selectedDeveloper.name}
                    </h2>
                    <p className="font-caption-xs text-caption-xs text-secondary">
                      {appsResult?.total ?? selectedDeveloper.appCount}{' '}
                      {(appsResult?.total ?? selectedDeveloper.appCount) === 1 ? 'app' : 'apps'}
                      {selectedDeveloper.verified ? ' · Verified developer' : ''}
                    </p>
                  </div>
                </div>
                <IconButton
                  icon="close"
                  label="Close developer apps"
                  onClick={clearSelection}
                  variant="secondary"
                />
              </div>

              {appsState === 'loading' && (
                <p className="mt-unit-lg flex items-center gap-unit-xs font-body-sm text-body-sm text-secondary" role="status">
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  Loading apps…
                </p>
              )}

              {appsState === 'error' && (
                <div className="mt-unit-lg rounded-lg border border-error/30 bg-error/5 p-unit-sm" role="alert">
                  <p className="font-label-md text-label-md font-semibold text-error">Apps unavailable</p>
                  <p className="mt-unit-2xs font-body-sm text-body-sm text-secondary">{appsError}</p>
                  <Button
                    className="mt-unit-sm"
                    iconLeading="refresh"
                    onClick={() => void loadApps(selectedDeveloper)}
                    size="sm"
                    variant="outline"
                  >
                    Try again
                  </Button>
                </div>
              )}

              {appsState === 'success' && apps.length === 0 && (
                <p className="mt-unit-lg font-body-sm text-body-sm text-secondary">
                  No published apps were returned for this developer.
                </p>
              )}

              {apps.length > 0 && (
                <ul className="mt-unit-lg grid max-h-[36rem] grid-cols-1 gap-unit-md overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                  {apps.map((app) => (
                    <li
                      className="flex min-w-0 flex-col gap-unit-sm rounded-lg border border-outline-variant/30 bg-surface-container-low p-unit-sm"
                      key={app.id}
                    >
                      <div className="flex min-w-0 items-start gap-unit-sm">
                        <AppIcon app={app} />
                        <div className="min-w-0">
                          <p className="truncate font-body-sm text-body-sm font-medium text-on-surface">
                            {app.name}
                          </p>
                          <p className="truncate font-caption-xs text-caption-xs text-secondary">
                            {app.packageId}
                          </p>
                        </div>
                      </div>

                      {(app.scoreText || app.price !== undefined) && (
                        <div className="flex flex-wrap items-center gap-unit-xs font-caption-xs text-caption-xs text-secondary">
                          {app.scoreText && (
                            <span className="inline-flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[13px] text-primary">star</span>
                              {app.scoreText}
                            </span>
                          )}
                          {app.price !== undefined && <span>{String(app.price)}</span>}
                        </div>
                      )}

                      <div className="mt-auto flex flex-wrap items-center justify-between gap-unit-xs">
                        <a
                          className="inline-flex items-center gap-1.5 font-label-md text-label-md text-primary transition-colors hover:text-tertiary"
                          href={app.playStoreUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                          aria-label="Open on Google Play Store"
                        >
                          <img
                            src="/google-play.png"
                            alt="Google Play"
                            className="w-5 h-5"
                            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
                          />
                          <span className="hidden sm:inline">Play Store</span>
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        </a>
                        {trackedPackageIds.has(app.packageId) ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-caption-xs text-caption-xs font-semibold text-primary">
                            <span className="material-symbols-outlined text-[13px]">check_circle</span>
                            Tracked
                          </span>
                        ) : (
                          <Button
                            disabled={trackingPackageId !== null}
                            iconLeading="add"
                            onClick={() => void trackApp(app)}
                            size="sm"
                            variant="outline"
                          >
                            {trackingPackageId === app.packageId ? 'Tracking…' : 'Track'}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};
