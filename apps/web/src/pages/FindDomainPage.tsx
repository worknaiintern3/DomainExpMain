import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FindDomainHeader,
  DomainSearchHero,
  TldAvailabilityResults,
  RegistrarPriceCards,
  DomainLookupInspector,
  WatchlistSection,
  SearchEmptyState,
  SearchState,
  DomainAvailabilityStatus,
  TldAvailabilityItem,
  WatchlistItem,
  SUPPORTED_TLDS,
  FindDomainSummary,
} from '@/features/find-domain';
import {
  AVAILABILITY_PROVIDER_LABELS,
  formatMinorUnits,
  searchDomainAvailability,
  type DomainAvailabilityResult,
} from '@/api/domain-search';
import { ApiError } from '@/api/client';
import { addRecentSearch, clearRecentSearches, readRecentSearches } from '@/lib/recentSearches';
import { usePreferences } from '@/preferences/PreferencesContext';

interface LiveRow {
  item: TldAvailabilityItem;
  results: DomainAvailabilityResult[];
  requestError: string | null;
}

function expandSearchDomains(input: string, tlds: string[]): string[] {
  const trimmed = input.trim().toLowerCase().replace(/\.$/u, '');
  if (trimmed.length === 0) return [];
  if (trimmed.includes('.')) return [trimmed];
  const keyword = trimmed.replace(/[^a-z0-9-]/gu, '');
  if (keyword.length === 0) return [];
  return tlds.map((tld) => `${keyword}${tld}`);
}

function tldOf(domain: string): string {
  const dot = domain.indexOf('.');
  return dot >= 0 ? domain.slice(dot) : '';
}

function aggregateStatus(results: DomainAvailabilityResult[]): DomainAvailabilityStatus {
  const states = new Set(results.map((result) => result.state));
  if (states.has('AVAILABLE') || states.has('PREMIUM')) return 'available';
  if (states.has('UNAVAILABLE')) return 'registered';
  return 'unknown';
}

function statusLabel(status: DomainAvailabilityStatus, premium: boolean): string {
  if (status === 'available') return premium ? 'Available · Premium' : 'Possibly available';
  if (status === 'registered') return 'Likely registered';
  return 'Unknown';
}

function pricedResult(results: DomainAvailabilityResult[]): DomainAvailabilityResult | undefined {
  const ordered = [...results].sort((a, b) => {
    const rank = (state: DomainAvailabilityResult['state']): number =>
      state === 'AVAILABLE' ? 0 : state === 'PREMIUM' ? 1 : 2;
    return rank(a.state) - rank(b.state);
  });
  return ordered.find(
    (result) =>
      (result.state === 'AVAILABLE' || result.state === 'PREMIUM') &&
      result.registrationPriceMinorUnits !== null,
  );
}

type SearchSort = 'availability' | 'price' | 'tld' | 'match';

const AVAILABILITY_RANK: Record<DomainAvailabilityStatus, number> = {
  available: 0,
  registered: 1,
  unknown: 2,
};

/** Orders results by the user's default sort. Prices are never converted between currencies, so mixed-currency pairs keep availability order. */
function sortRows(rows: LiveRow[], sort: SearchSort): LiveRow[] {
  if (sort === 'match') return rows;
  const byAvailability = (a: LiveRow, b: LiveRow) =>
    AVAILABILITY_RANK[a.item.status] - AVAILABILITY_RANK[b.item.status];
  const copy = [...rows];
  if (sort === 'tld') return copy.sort((a, b) => a.item.tld.localeCompare(b.item.tld));
  if (sort === 'availability') return copy.sort(byAvailability);

  return copy.sort((a, b) => {
    const priceA = pricedResult(a.results);
    const priceB = pricedResult(b.results);
    if (!priceA && !priceB) return byAvailability(a, b);
    if (!priceA) return 1;
    if (!priceB) return -1;
    if (priceA.currency !== priceB.currency) return byAvailability(a, b);
    return (priceA.registrationPriceMinorUnits ?? 0) - (priceB.registrationPriceMinorUnits ?? 0);
  });
}

function buildRow(
  domain: string,
  results: DomainAvailabilityResult[],
  requestError: string | null,
  isSaved: boolean,
): LiveRow {
  const status = requestError ? 'unknown' : aggregateStatus(results);
  const priced = requestError ? undefined : pricedResult(results);
  const source = priced ? AVAILABILITY_PROVIDER_LABELS[priced.provider] : undefined;
  const firstYear = priced
    ? formatMinorUnits(priced.registrationPriceMinorUnits, priced.currency)
    : null;
  const renewal = priced
    ? formatMinorUnits(priced.renewalPriceMinorUnits, priced.currency)
    : null;
  const premium = results.some((result) => result.premium);
  const partial = results.some((result) => result.state === 'ERROR');
  return {
    item: {
      bestRegistrar: source,
      bestRegistrarBadge: premium ? '(Premium)' : partial ? '(Partial)' : undefined,
      domain,
      firstYearPriceFormatted: firstYear ?? undefined,
      id: `live-${domain}`,
      isSaved,
      renewalPriceFormatted: renewal ?? undefined,
      status,
      statusLabel: requestError ? 'Check failed' : statusLabel(status, premium),
      tld: tldOf(domain),
      topPickTag: premium ? 'Premium' : undefined,
    },
    requestError,
    results,
  };
}

export const FindDomainPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const { discovery, status: preferencesStatus } = usePreferences();
  const [selectedTlds, setSelectedTlds] = useState<string[]>(SUPPORTED_TLDS);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches());
  const defaultsAppliedRef = useRef(false);

  // Start from the user's saved default TLDs once their settings have loaded.
  useEffect(() => {
    if (preferencesStatus !== 'ready' || defaultsAppliedRef.current) return;
    defaultsAppliedRef.current = true;
    const wanted = discovery.defaultCheckedTlds.filter((tld) => SUPPORTED_TLDS.includes(tld));
    if (wanted.length > 0) setSelectedTlds(wanted);
  }, [preferencesStatus, discovery.defaultCheckedTlds]);
  const [searchState, setSearchState] = useState<SearchState>('empty');
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Derived set of saved domain names
  const savedSet = useMemo(() => new Set(watchlist.map((w) => w.domain)), [watchlist]);

  const items = useMemo(
    () => sortRows(rows, discovery.defaultSearchSort).map((row) => ({ ...row.item, isSaved: savedSet.has(row.item.domain) })),
    [rows, savedSet],
  );

  const summary = useMemo<FindDomainSummary>(() => {
    const availableCount = rows.filter((row) => row.item.status === 'available').length;
    const registeredCount = rows.filter((row) => row.item.status === 'registered').length;
    const priced = rows.flatMap((row) =>
      row.results
        .filter(
          (result) =>
            (result.state === 'AVAILABLE' || result.state === 'PREMIUM') &&
            result.registrationPriceMinorUnits !== null &&
            result.currency !== null,
        )
        .map((result) => ({ domain: row.item.domain, result })),
    );
    const usdPriced = priced.filter((entry) => entry.result.currency === 'USD');
    const pool = usdPriced.length > 0 ? usdPriced : priced;
    const lowest =
      pool.length > 0
        ? pool.reduce((min, curr) =>
            (curr.result.registrationPriceMinorUnits ?? Number.MAX_SAFE_INTEGER) <
            (min.result.registrationPriceMinorUnits ?? Number.MAX_SAFE_INTEGER)
              ? curr
              : min,
          )
        : null;
    const lowestFormatted =
      lowest && lowest.result.registrationPriceMinorUnits !== null && lowest.result.currency
        ? formatMinorUnits(lowest.result.registrationPriceMinorUnits, lowest.result.currency)
        : null;
    return {
      activeQuery: query,
      availableCount,
      extensionsCheckedCount: rows.length,
      lowestRegDetails:
        lowest && lowestFormatted
          ? `(${lowest.domain} ${AVAILABILITY_PROVIDER_LABELS[lowest.result.provider]})`
          : '',
      lowestRegPriceFormatted: lowestFormatted ? `${lowestFormatted}/yr` : '—',
      registeredCount,
    };
  }, [rows, query]);

  const selectedRow = selectedDomain ? rows.find((row) => row.item.domain === selectedDomain) ?? null : null;
  const inspectorDomain = selectedRow?.item.domain ?? rows[0]?.item.domain ?? '';
  const inspectorResults = selectedRow?.results ?? rows[0]?.results ?? [];
  const inspectorError = selectedRow?.requestError ?? (rows[0]?.requestError ?? null);
  const inspectorStatus = selectedRow?.item.status ?? rows[0]?.item.status ?? 'unknown';
  const inspectorAvailable = inspectorStatus === 'available';

  const allUnconfigured =
    rows.length > 0 &&
    rows.every((row) => row.results.length > 0 && row.results.every((r) => r.state === 'UNCONFIGURED'));
  const partialFailures = rows.filter((row) =>
    row.results.some((result) => result.state === 'ERROR'),
  ).length;

  const handleSearch = async (newQuery: string) => {
    const tlds = discovery.availabilityCheckMode === 'all' ? SUPPORTED_TLDS : selectedTlds;
    const domains = expandSearchDomains(newQuery, tlds);
    setQuery(newQuery.trim());
    if (domains.length > 0 && discovery.savedSearchHistory) {
      setRecentSearches(addRecentSearch(newQuery));
    }
    if (domains.length === 0) {
      abortRef.current?.abort();
      setRows([]);
      setSelectedDomain(null);
      setSearchError(null);
      setSearchState('empty');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setSearchState('loading');
    setSearchError(null);

    const settled = await Promise.allSettled(
      domains.map((domain) => searchDomainAvailability(domain, controller.signal)),
    );
    if (controller.signal.aborted || requestIdRef.current !== requestId) return;

    const nextRows = settled.map((outcome, index) => {
      const domain = domains[index] as string;
      if (outcome.status === 'fulfilled') {
        return buildRow(domain, outcome.value.results, null, savedSet.has(domain));
      }
      const reason =
        outcome.reason instanceof ApiError
          ? outcome.reason.status === 404
            ? 'Live registrar availability and pricing are not available on this backend.'
            : outcome.reason.detail
          : 'The availability check could not be completed.';
      return buildRow(domain, [], reason, savedSet.has(domain));
    });

    setRows(nextRows);
    setSelectedDomain(nextRows[0]?.item.domain ?? null);
    if (nextRows.length > 0 && nextRows.every((row) => row.requestError)) {
      setSearchError(nextRows[0]?.requestError ?? 'The availability check could not be completed.');
      setSearchState('error');
    } else {
      setSearchState('results');
    }
  };

  const handleToggleTld = (tld: string) => {
    setSelectedTlds((prev) =>
      prev.includes(tld) ? prev.filter((t) => t !== tld) : [...prev, tld],
    );
  };

  const handleSelectAllTlds = () => {
    if (selectedTlds.length === SUPPORTED_TLDS.length) {
      setSelectedTlds(['.com', '.in']);
    } else {
      setSelectedTlds(SUPPORTED_TLDS);
    }
  };

  const handleSelectDomain = (domain: string) => {
    setSelectedDomain(domain);
  };

  const watchlistPriceFor = (domain: string): { price: string; registrar: string; status: DomainAvailabilityStatus } => {
    const row = rows.find((candidate) => candidate.item.domain === domain);
    const priced = row ? pricedResult(row.results) : undefined;
    const formatted = priced
      ? formatMinorUnits(priced.registrationPriceMinorUnits, priced.currency)
      : null;
    return {
      price: formatted ? `${formatted}/yr` : 'Price unavailable',
      registrar: priced ? AVAILABILITY_PROVIDER_LABELS[priced.provider] : 'Live check',
      status: row?.item.status ?? 'unknown',
    };
  };

  const handleToggleWatchlist = (
    item: TldAvailabilityItem | { domain: string; priceFormatted: string; registrarHint?: string },
  ) => {
    if (savedSet.has(item.domain)) {
      setWatchlist((prev) => prev.filter((w) => w.domain !== item.domain));
      return;
    }
    const live = watchlistPriceFor(item.domain);
    const newItem: WatchlistItem = {
      domain: item.domain,
      id: `watch-${Date.now()}-${item.domain}`,
      priceFormatted: live.price,
      registrarNote: live.registrar,
      status: live.status,
    };
    setWatchlist((prev) => [newItem, ...prev]);
  };

  const handleToggleWatchlistFromInspector = (domain: string) => {
    if (savedSet.has(domain)) {
      setWatchlist((prev) => prev.filter((w) => w.domain !== domain));
    } else {
      const live = watchlistPriceFor(domain);
      const newItem: WatchlistItem = {
        domain,
        id: `watch-${Date.now()}-${domain}`,
        priceFormatted: live.price,
        registrarNote: live.registrar,
        status: live.status,
      };
      setWatchlist((prev) => [newItem, ...prev]);
    }
  };

  const handleRemoveWatchlist = (id: string) => {
    setWatchlist((prev) => prev.filter((w) => w.id !== id));
  };

  const handleClearWatchlist = () => {
    setWatchlist([]);
  };

  const handleScrollToWatchlist = () => {
    const el = document.getElementById('saved-watchlist-widget');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      el.classList.add('ring-2', 'ring-primary');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 600);
    }
  };

  return (
    <div className="flex flex-col gap-unit-md w-full pb-unit-2xl">
      {/* Header with Title and Watchlist Button */}
      <FindDomainHeader watchlistCount={watchlist.length} onOpenWatchlist={handleScrollToWatchlist} />

      {/* Primary Search Hero with TLD filters & metrics */}
      <DomainSearchHero
        query={query}
        onQueryChange={setQuery}
        onSearch={handleSearch}
        selectedTlds={selectedTlds}
        onToggleTld={handleToggleTld}
        onSelectAllTlds={handleSelectAllTlds}
        summary={summary}
        showSummary={searchState === 'results'}
      />

      {discovery.savedSearchHistory && recentSearches.length > 0 && (
        <div className="flex flex-wrap items-center gap-unit-xs" aria-label="Recent searches">
          <span className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">Recent</span>
          {recentSearches.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => {
                setQuery(term);
                void handleSearch(term);
              }}
              className="rounded-full border border-outline-variant/50 bg-surface-container-lowest px-3 py-1 text-label-md text-on-surface hover:bg-surface-container-low"
            >
              {term}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              clearRecentSearches();
              setRecentSearches([]);
            }}
            className="text-label-md text-secondary underline-offset-2 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {allUnconfigured && searchState === 'results' && (
        <aside
          className="rounded-lg border border-amber-200/50 bg-amber-50 px-unit-base py-unit-sm text-body-sm text-amber-900"
          role="note"
        >
          <strong>Live registrar search isn&apos;t configured.</strong> DomainPulse&apos;s registrar
          lookup service has no provider credentials set up yet, so live availability checks can&apos;t
          run. You don&apos;t need to connect your own account.
        </aside>
      )}

      {partialFailures > 0 && searchState === 'results' && (
        <aside
          className="rounded-lg border border-amber-200/50 bg-amber-50 px-unit-base py-unit-sm text-body-sm text-amber-900"
          role="note"
        >
          <strong>Partial results.</strong> {partialFailures} of {rows.length} domains had at
          least one provider check fail. Successful provider results are unaffected.
        </aside>
      )}

      {/* Main Content Area depending on SearchState */}
      {searchState === 'results' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-unit-lg items-start">
          {/* Left Column (8 cols): TLD Availability Table */}
          <div className="xl:col-span-8 flex flex-col gap-unit-base min-w-0">
            <TldAvailabilityResults
              items={items}
              selectedDomain={inspectorDomain}
              onSelectDomain={handleSelectDomain}
              onToggleWatchlist={handleToggleWatchlist}
              onCompareRegistrars={handleSelectDomain}
            />
          </div>

          {/* Right Column (4 cols): Provider Breakdown, Registrar Pricing & Watchlist */}
          <div className="xl:col-span-4 flex flex-col gap-unit-base">
            {inspectorDomain && (
              <DomainLookupInspector
                domain={inspectorDomain}
                status={inspectorStatus}
                results={inspectorResults}
                requestError={inspectorError}
                onToggleWatchlist={handleToggleWatchlistFromInspector}
                isSaved={savedSet.has(inspectorDomain)}
              />
            )}

            {inspectorDomain && (
              <RegistrarPriceCards
                domain={inspectorDomain}
                isAvailable={inspectorAvailable}
                results={inspectorResults}
              />
            )}

            <WatchlistSection
              watchlist={watchlist}
              onInspect={(domain, status) => {
                setSelectedDomain(domain);
                void status;
              }}
              onRemove={handleRemoveWatchlist}
              onClearAll={handleClearWatchlist}
            />
          </div>
        </div>
      )}

      {/* State 2: Checking / Loading State */}
      {searchState === 'loading' && (
        <div className="flex flex-col items-center justify-center p-unit-2xl bg-surface-container-lowest rounded-xl shadow-sm text-center border border-outline-variant/30">
          <div className="w-16 h-16 relative flex items-center justify-center mb-unit-md">
            <div className="absolute inset-0 rounded-full border-4 border-surface-container-highest border-t-primary animate-spin"></div>
            <span className="material-symbols-outlined text-primary text-[28px]">dns</span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-unit-xs font-semibold">
            Checking selected domain extensions...
          </h3>
          <p className="font-body-md text-body-md text-secondary max-w-md mb-unit-lg">
            Running live availability checks for query &quot;{query}&quot;
          </p>
          <div className="w-full max-w-lg bg-surface-container-low rounded-lg p-unit-md flex flex-col gap-2 font-caption-xs text-caption-xs border border-outline-variant/20">
            <div className="flex items-center justify-between text-secondary">
              <span>Checking extensions status</span>
              <span className="text-primary font-semibold font-label-mono animate-pulse">
                Evaluating...
              </span>
            </div>
            <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full w-4/5 animate-pulse"></div>
            </div>
            <p className="text-center text-outline text-[11px] pt-1">
              Live checks run against registrar APIs.
            </p>
          </div>
        </div>
      )}

      {/* State 3: Empty State */}
      {searchState === 'empty' && <SearchEmptyState onSelectPrompt={handleSearch} />}

      {/* State 4: Error State */}
      {searchState === 'error' && (
        <div className="flex flex-col items-center justify-center p-unit-2xl bg-surface-container-lowest rounded-xl shadow-sm text-center border border-outline-variant/30">
          <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-700 mb-unit-md border border-rose-200/50">
            <span className="material-symbols-outlined text-[32px]">error</span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-unit-xs font-semibold">
            Availability check failed
          </h3>
          <p className="font-body-md text-body-md text-secondary max-w-md mb-unit-lg">
            {searchError ?? 'The availability check could not be completed.'}
          </p>
          <button
            type="button"
            onClick={() => handleSearch(query)}
            className="h-9 px-unit-md rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors cursor-pointer"
          >
            Retry search
          </button>
        </div>
      )}
    </div>
  );
};

export default FindDomainPage;
