import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import {
  searchDomainAvailability,
  type DomainAvailabilityProvider,
  type DomainSearchResponse,
} from '@/api/domain-search';
import {
  loadPricingPreferences,
  horizonYearsOf,
  sortOptionOf,
  visibleColumnsOf,
} from '@/features/settings/pricing-preferences';
import {
  PricingDisclaimer,
  PricingHeader,
  PricingSummaryStrip,
  PricingSearchBar,
  OwnershipCostBenchmark,
  RegistrarComparisonMatrix,
  PricingInspector,
  TransferSavingsCalculator,
  PRICING_TLD_SHORTCUTS,
  formatFetchedAt,
  formatRegistrarConfiguration,
  isDefinitive,
  pricedCurrencies,
  providerLabel,
  sortResults,
  type HorizonYears,
  type PricingSearchState,
  type PricingSortOption,
} from '@/features/pricing';

const INVALID_DOMAIN_MESSAGE =
  'Enter a full domain such as example.com, or type a name and pick an extension below.';

/** Trims, lowercases, and drops any scheme, path, or trailing dot the user pasted. */
function normalizeDomainInput(raw: string): string {
  const withoutScheme = raw.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//u, '');
  const host = withoutScheme.split(/[/?#]/u)[0] ?? '';
  return host.replace(/\.$/u, '');
}

function isFullDomain(domain: string): boolean {
  return /^[^\s.]+(?:\.[^\s.]+)+$/u.test(domain);
}

function tldShortcutOf(domain: string): string | null {
  const matches = PRICING_TLD_SHORTCUTS.filter((tld) => domain.endsWith(tld));
  matches.sort((a, b) => b.length - a.length);
  return matches[0] ?? null;
}

export const PricingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const domainParam = searchParams.get('domain');

  const [domainInput, setDomainInput] = useState<string>(domainParam ?? '');
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [searchState, setSearchState] = useState<PricingSearchState>('idle');
  const [response, setResponse] = useState<DomainSearchResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [pricingPrefs] = useState(loadPricingPreferences);
  const [sortOption, setSortOption] = useState<PricingSortOption>(() => sortOptionOf(pricingPrefs));
  const [selectedProvider, setSelectedProvider] = useState<DomainAvailabilityProvider | null>(null);
  const [horizon, setHorizon] = useState<HorizonYears>(() => horizonYearsOf(pricingPrefs));
  const visibleColumns = useMemo(() => visibleColumnsOf(pricingPrefs), [pricingPrefs]);
  const [showMethodologyModal, setShowMethodologyModal] = useState<boolean>(false);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (raw: string) => {
    const domain = normalizeDomainInput(raw);
    if (!isFullDomain(domain)) {
      setValidationMessage(INVALID_DOMAIN_MESSAGE);
      return;
    }
    setValidationMessage(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setActiveDomain(domain);
    setSearchState('loading');
    setRequestError(null);
    setResponse(null);
    setSelectedProvider(null);

    try {
      const next = await searchDomainAvailability(domain, controller.signal);
      if (controller.signal.aborted || requestIdRef.current !== requestId) return;
      setResponse(next);
      setSearchState('results');
    } catch (error) {
      if (controller.signal.aborted || requestIdRef.current !== requestId) return;
      setRequestError(
        error instanceof ApiError
          ? error.status === 404
            ? 'Live registrar pricing is not available on this backend.'
            : error.detail
          : 'The price comparison could not be completed. Please try again.',
      );
      setSearchState('error');
    }
  }, []);

  // A domain in the URL (e.g. the "Compare" link on Find Domain) runs immediately.
  useEffect(() => {
    if (domainParam) {
      setDomainInput(domainParam);
      void runSearch(domainParam);
    }
  }, [domainParam, runSearch]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const handleSelectTld = (tld: string) => {
    const base = normalizeDomainInput(domainInput);
    const keyword = (base.includes('.') ? base.slice(0, base.indexOf('.')) : base).replace(
      /[^a-z0-9-]/gu,
      '',
    );
    if (keyword.length === 0) {
      setValidationMessage('Type a domain name first, then pick an extension.');
      return;
    }
    const next = `${keyword}${tld}`;
    setDomainInput(next);
    void runSearch(next);
  };

  const results = useMemo(() => response?.results ?? [], [response]);
  const sortedResults = useMemo(() => sortResults(results, sortOption), [results, sortOption]);
  const selectedResult =
    sortedResults.find((result) => result.provider === selectedProvider) ?? sortedResults[0];
  const currencies = useMemo(() => pricedCurrencies(results), [results]);

  const hasResults = searchState === 'results' && results.length > 0;
  const allUnconfigured = hasResults && results.every((r) => r.state === 'UNCONFIGURED');
  const unconfiguredCount = results.filter((r) => r.state === 'UNCONFIGURED').length;
  const definitive = results.filter(isDefinitive);
  const allRegistered =
    hasResults && definitive.length > 0 && definitive.every((r) => r.state === 'UNAVAILABLE');
  const failedProviders = results.filter((r) => r.state === 'ERROR' || r.errorCode !== null);
  const fetchedAt = results[0]?.fetchedAt;

  return (
    <div className="flex flex-col gap-unit-md w-full pb-unit-2xl">
      {/* 1. LIVE PRICING DISCLAIMER */}
      <PricingDisclaimer />

      {/* Domain context callout */}
      {activeDomain && (
        <div className="px-unit-base py-2 rounded-lg bg-secondary-container/40 flex items-center justify-between gap-unit-sm border border-secondary-container">
          <div className="flex items-center gap-unit-xs text-caption-xs font-caption-xs">
            <span className="material-symbols-outlined text-primary text-[18px]">travel_explore</span>
            <span className="text-secondary">Comparing live registrar pricing for:</span>
            <span className="font-label-mono font-bold text-primary text-body-sm">{activeDomain}</span>
            {tldShortcutOf(activeDomain) && (
              <span className="px-1.5 py-0.2 rounded bg-secondary-container text-primary font-semibold text-[10px]">
                {tldShortcutOf(activeDomain)}
              </span>
            )}
          </div>
          {fetchedAt && hasResults && (
            <span className="text-caption-xs text-secondary italic hidden sm:inline">
              Fetched at {formatFetchedAt(fetchedAt)}
            </span>
          )}
        </div>
      )}

      {/* 2. PAGE HEADER & PRIMARY CONTROLS */}
      <PricingHeader onOpenMethodology={() => setShowMethodologyModal(true)} />

      {/* 3. REGISTRAR PRICE COMPARISON */}
      <div className="flex flex-col gap-unit-md">
        <PricingSearchBar
          domainInput={domainInput}
          onDomainInputChange={(value) => {
            setDomainInput(value);
            setValidationMessage(null);
          }}
          onSubmit={() => {
            void runSearch(domainInput);
          }}
          isLoading={searchState === 'loading'}
          activeTld={tldShortcutOf(normalizeDomainInput(domainInput))}
          onSelectTld={handleSelectTld}
          sortOption={sortOption}
          onSortChange={setSortOption}
          currencies={currencies}
          validationMessage={validationMessage}
        />

        {searchState === 'loading' && (
          <p role="status" className="font-caption-xs text-caption-xs text-secondary">
            Fetching live prices from registrars…
          </p>
        )}

        {searchState === 'error' && requestError && (
          <aside
            role="alert"
            className="rounded-lg border border-rose-200/60 bg-rose-50 px-unit-base py-unit-sm text-body-sm text-rose-900 flex flex-wrap items-center justify-between gap-unit-sm"
          >
            <span>
              <strong>Price comparison failed.</strong> {requestError}
            </span>
            {activeDomain && (
              <button
                type="button"
                onClick={() => {
                  void runSearch(activeDomain);
                }}
                className="h-8 px-unit-sm rounded bg-rose-100 text-rose-900 font-label-md text-label-md hover:bg-rose-200 transition-colors cursor-pointer"
              >
                Retry
              </button>
            )}
          </aside>
        )}

        {allUnconfigured && (
          <aside
            role="note"
            className="rounded-lg border border-amber-200/50 bg-amber-50 px-unit-base py-unit-sm text-body-sm text-amber-900"
          >
            <strong>Live registrar pricing isn&apos;t configured.</strong> DomainPulse&apos;s
            registrar lookup service has no provider credentials set up yet, so no prices can be
            fetched. You don&apos;t need to connect your own account.
          </aside>
        )}

        {allRegistered && activeDomain && (
          <aside
            role="note"
            className="rounded-lg border border-rose-200/50 bg-rose-50 px-unit-base py-unit-sm text-body-sm text-rose-900"
          >
            <strong>{activeDomain} is already registered.</strong> Registrars only return prices
            for domains that can be registered right now, so no prices are shown. Try another name
            or extension.
          </aside>
        )}

        {hasResults && !allUnconfigured && unconfiguredCount > 0 && (
          <aside
            role="note"
            className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-unit-base py-unit-sm text-body-sm text-on-surface-variant"
          >
            <strong>{formatRegistrarConfiguration(unconfiguredCount, results.length)}</strong>{' '}
            in DomainPulse and were not queried.
          </aside>
        )}

        {hasResults && failedProviders.length > 0 && (
          <aside
            role="note"
            className="rounded-lg border border-amber-200/50 bg-amber-50 px-unit-base py-unit-sm text-body-sm text-amber-900"
          >
            <strong>Partial results.</strong>{' '}
            {failedProviders.map((result) => providerLabel(result.provider)).join(', ')} could not
            return {failedProviders.length === 1 ? 'a' : ''} complete
            {failedProviders.length === 1 ? ' result' : ' results'}. Prices from the other
            registrars are unaffected.
          </aside>
        )}

        {hasResults && currencies.length > 1 && (
          <aside
            role="note"
            className="rounded-lg border border-amber-200/50 bg-amber-50 px-unit-base py-unit-sm text-body-sm text-amber-900"
          >
            <strong>Mixed currencies ({currencies.join(', ')}).</strong> Registrars returned prices
            in different currencies. DomainPulse does not convert currencies, so these prices are
            not directly comparable and are never ranked against each other.
          </aside>
        )}

        {/* SUMMARY STRIP */}
        {hasResults && <PricingSummaryStrip results={results} />}

        {/* OWNERSHIP COST BENCHMARK */}
        {hasResults && (
          <OwnershipCostBenchmark
            results={results}
            horizon={horizon}
            onHorizonChange={setHorizon}
            domain={activeDomain}
          />
        )}

        {/* MAIN DATA MATRIX & PROVIDER INSPECTION DRAWER (SPLIT VIEW) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-unit-md items-start">
          <div className="xl:col-span-8">
            <RegistrarComparisonMatrix
              results={sortedResults}
              searchState={searchState}
              domain={activeDomain}
              selectedProvider={selectedResult?.provider ?? null}
              onSelectProvider={setSelectedProvider}
              visibleColumns={visibleColumns}
              markupThresholdPercent={pricingPrefs.renewalMarkupThreshold}
            />
          </div>

          <div className="xl:col-span-4">
            <PricingInspector result={hasResults ? selectedResult : undefined} />
          </div>
        </div>

        {/* TRANSFER SAVINGS CALCULATOR */}
        {hasResults && <TransferSavingsCalculator results={results} domain={activeDomain} />}
      </div>

      {/* Methodology Modal */}
      {showMethodologyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pricing methodology"
            className="bg-surface-container-lowest rounded-xl max-w-xl w-full p-unit-lg shadow-xl border border-outline-variant/30 flex flex-col gap-unit-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-unit-xs">
                <span className="material-symbols-outlined text-secondary text-[20px]">balance</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Methodology &amp; Data Sources
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMethodologyModal(false)}
                aria-label="Close methodology"
                className="p-1 rounded text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-unit-sm text-body-sm text-secondary leading-relaxed">
              <p>
                <strong>Live sources.</strong> Each search queries the registrars&apos; official
                APIs in real time through DomainPulse&apos;s central service accounts.{' '}
                <strong>GoDaddy</strong>: availability pricing (indicative, not a locked quote).{' '}
                <strong>Namecheap</strong>: the official price list (list price; the separate ICANN
                fee is not added). <strong>Cloudflare</strong>: Registrar domain-check pricing
                (registration and renewal; no transfer price is returned).
              </p>
              <p>
                <strong>Only what the API returns.</strong> A dash means the registrar did not
                return that price. Nothing is estimated, scraped or filled in. Prices are only
                returned for domains that can be registered right now.
              </p>
              <p>
                <strong>Currencies.</strong> Each registrar is shown in its own currency. There is no
                exchange-rate source, so different currencies are never converted, summed or ranked
                against each other.
              </p>
              <p>
                <strong>Ownership cost.</strong> Uses the returned prices and assumes renewals stay
                unchanged:
                <code className="block p-2 bg-surface-container-low rounded my-1 font-label-mono text-[12px] text-on-surface">
                  N-Yr Cost = Year_1_Registration + ((N − 1) × Renewal_Rate)
                </code>
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowMethodologyModal(false)}
              className="mt-2 h-9 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-tertiary transition-colors cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingPage;
