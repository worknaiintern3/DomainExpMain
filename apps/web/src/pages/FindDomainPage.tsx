import React, { useState, useMemo } from 'react';
import {
  FindDomainHeader,
  DomainSearchHero,
  TldAvailabilityResults,
  DomainSuggestionSection,
  RegistrarPriceCards,
  DomainLookupInspector,
  WatchlistSection,
  SearchEmptyState,
  SearchState,
  DomainAvailabilityStatus,
  TldAvailabilityItem,
  WatchlistItem,
  SUPPORTED_TLDS,
  INITIAL_WATCHLIST,
  searchDomains,
  getRegistrarQuotesForDomain,
  getDomainInspectionDetails,
} from '@/features/find-domain';

export const FindDomainPage: React.FC = () => {
  const [query, setQuery] = useState('worknai');
  const [selectedTlds, setSelectedTlds] = useState<string[]>(SUPPORTED_TLDS);
  const [searchState, setSearchState] = useState<SearchState>('results');
  const [selectedInspectionDomain, setSelectedInspectionDomain] = useState('worknai.com');
  const [selectedInspectionStatus, setSelectedInspectionStatus] = useState<DomainAvailabilityStatus>(
    'registered'
  );
  const [selectedCompareDomain, setSelectedCompareDomain] = useState('worknai.in');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(INITIAL_WATCHLIST);

  // Derived set of saved domain names
  const savedSet = useMemo(() => new Set(watchlist.map((w) => w.domain)), [watchlist]);

  // Derived search data
  const { items, summary, suggestions } = useMemo(
    () => searchDomains(query, selectedTlds, savedSet),
    [query, selectedTlds, savedSet]
  );

  // Derived inspection and pricing quotes
  const inspectionDetails = useMemo(
    () => getDomainInspectionDetails(selectedInspectionDomain, selectedInspectionStatus),
    [selectedInspectionDomain, selectedInspectionStatus]
  );

  const registrarQuotes = useMemo(
    () => getRegistrarQuotesForDomain(selectedCompareDomain),
    [selectedCompareDomain]
  );

  const handleSearch = (newQuery: string) => {
    const trimmed = newQuery.trim();
    setQuery(trimmed);
    if (!trimmed) {
      setSearchState('empty');
      return;
    }
    setSearchState('loading');
    setTimeout(() => {
      setSearchState('results');
      setSelectedInspectionDomain(`${trimmed}.com`);
      setSelectedInspectionStatus('registered');
      setSelectedCompareDomain(`${trimmed}.in`);
    }, 300);
  };

  const handleToggleTld = (tld: string) => {
    setSelectedTlds((prev) =>
      prev.includes(tld) ? prev.filter((t) => t !== tld) : [...prev, tld]
    );
  };

  const handleSelectAllTlds = () => {
    if (selectedTlds.length === SUPPORTED_TLDS.length) {
      setSelectedTlds(['.com', '.in']);
    } else {
      setSelectedTlds(SUPPORTED_TLDS);
    }
  };

  const handleSelectDomain = (domain: string, status: DomainAvailabilityStatus) => {
    setSelectedInspectionDomain(domain);
    setSelectedInspectionStatus(status);
    if (status === 'available') {
      setSelectedCompareDomain(domain);
    }
  };

  const handleToggleWatchlist = (
    item: TldAvailabilityItem | { domain: string; priceFormatted: string; registrarHint?: string }
  ) => {
    if (savedSet.has(item.domain)) {
      setWatchlist((prev) => prev.filter((w) => w.domain !== item.domain));
    } else {
      let price = '₹799/yr';
      let registrar = 'Preferred Registrar';

      if ('firstYearPriceFormatted' in item && item.firstYearPriceFormatted) {
        price = `${item.firstYearPriceFormatted}/yr`;
      } else if ('priceFormatted' in item) {
        price = item.priceFormatted;
      }

      if ('bestRegistrar' in item && item.bestRegistrar) {
        registrar = item.bestRegistrar;
      } else if ('registrarHint' in item && item.registrarHint) {
        registrar = item.registrarHint;
      }

      const newItem: WatchlistItem = {
        id: `watch-${Date.now()}-${item.domain}`,
        domain: item.domain,
        status: 'status' in item ? item.status : 'available',
        priceFormatted: price,
        registrarNote: registrar,
      };
      setWatchlist((prev) => [newItem, ...prev]);
    }
  };

  const handleToggleWatchlistFromInspector = (domain: string) => {
    if (savedSet.has(domain)) {
      setWatchlist((prev) => prev.filter((w) => w.domain !== domain));
    } else {
      const newItem: WatchlistItem = {
        id: `watch-${Date.now()}-${domain}`,
        domain,
        status: selectedInspectionStatus,
        priceFormatted: selectedInspectionStatus === 'available' ? '₹799/yr' : 'Monitored Expiry',
        registrarNote: inspectionDetails.sponsoringRegistrar,
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
      {/* Header with Title, State Switcher and Watchlist Button */}
      <FindDomainHeader
        searchState={searchState}
        onStateChange={setSearchState}
        watchlistCount={watchlist.length}
        onOpenWatchlist={handleScrollToWatchlist}
      />

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

      {/* Main Content Area depending on SearchState */}
      {searchState === 'results' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-unit-lg items-start">
          {/* Left Column (8 cols): TLD Availability Table & Smart Suggestions */}
          <div className="xl:col-span-8 flex flex-col gap-unit-base min-w-0">
            <TldAvailabilityResults
              items={items}
              selectedDomain={selectedInspectionDomain}
              onSelectDomain={handleSelectDomain}
              onToggleWatchlist={handleToggleWatchlist}
              onCompareRegistrars={(domain) => setSelectedCompareDomain(domain)}
            />

            <DomainSuggestionSection
              query={query}
              suggestions={suggestions}
              onSelectDomain={handleSelectDomain}
              onToggleWatchlist={handleToggleWatchlist}
            />
          </div>

          {/* Right Column (4 cols): WHOIS/RDAP Inspector, Registrar Price Matrix & Watchlist */}
          <div className="xl:col-span-4 flex flex-col gap-unit-base">
            <DomainLookupInspector
              details={inspectionDetails}
              onToggleWatchlist={handleToggleWatchlistFromInspector}
              isSaved={savedSet.has(selectedInspectionDomain)}
            />

            <RegistrarPriceCards
              domain={selectedCompareDomain}
              isAvailable={true}
              quotes={registrarQuotes}
            />

            <WatchlistSection
              watchlist={watchlist}
              onInspect={(domain, status) => handleSelectDomain(domain, status)}
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
            Evaluating .com, .in, .co.in, .ai, .io and other selected TLDs for query "{query}"
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
              Availability results are rendered using prototype/reference data.
            </p>
          </div>
        </div>
      )}

      {/* State 3: Empty State */}
      {searchState === 'empty' && (
        <SearchEmptyState onSelectPrompt={handleSearch} />
      )}
    </div>
  );
};

export default FindDomainPage;
