import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  PricingDisclaimer,
  PricingHeader,
  PricingSummaryStrip,
  TldPricingFilters,
  OwnershipCostBenchmark,
  RegistrarComparisonMatrix,
  PricingInspector,
  TransferSavingsCalculator,
  HostingPricingMatrix,
  PricingMode,
  PricingSortOption,
  HorizonYears,
  SavedComparisonItem,
  RegistrarPricing,
  SUPPORTED_PRICING_TLDS,
  INITIAL_SAVED_COMPARISONS,
  getRegistrarsForTld,
  calculatePricingSummary,
  calculateOwnershipCosts,
} from '@/features/pricing';

export const PricingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const domainParam = searchParams.get('domain');

  // Derive initial TLD from query parameter if present
  const initialTld = useMemo(() => {
    if (!domainParam) return '.com';
    const trimmed = domainParam.trim().toLowerCase();
    for (const tld of SUPPORTED_PRICING_TLDS) {
      if (trimmed.endsWith(tld)) {
        return tld;
      }
    }
    return '.com';
  }, [domainParam]);

  const [mode, setMode] = useState<PricingMode>('registrars');
  const [selectedTld, setSelectedTld] = useState<string>(initialTld);
  const [sortOption, setSortOption] = useState<PricingSortOption>('best-value');
  const [filterText, setFilterText] = useState<string>('');
  const [requirePrivacy, setRequirePrivacy] = useState<boolean>(false);
  const [requireDnssec, setRequireDnssec] = useState<boolean>(false);
  const [selectedRegistrarId, setSelectedRegistrarId] = useState<string>('porkbun');
  const [horizon, setHorizon] = useState<HorizonYears>(5);
  const [savedComparisons, setSavedComparisons] = useState<SavedComparisonItem[]>(
    INITIAL_SAVED_COMPARISONS
  );
  const [showSavedModal, setShowSavedModal] = useState<boolean>(false);
  const [showMethodologyModal, setShowMethodologyModal] = useState<boolean>(false);

  // Sync TLD if URL query changes
  useEffect(() => {
    if (domainParam) {
      const trimmed = domainParam.trim().toLowerCase();
      for (const tld of SUPPORTED_PRICING_TLDS) {
        if (trimmed.endsWith(tld)) {
          setSelectedTld(tld);
          break;
        }
      }
    }
  }, [domainParam]);

  // Derived registrars dataset for the selected TLD
  const baseRegistrars = useMemo(() => getRegistrarsForTld(selectedTld), [selectedTld]);

  // Filtered & Sorted registrars for the table view
  const filteredRegistrars = useMemo(() => {
    let result = [...baseRegistrars];

    if (filterText.trim()) {
      const query = filterText.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.registrarName.toLowerCase().includes(query) ||
          (r.icannId && r.icannId.toLowerCase().includes(query)) ||
          r.tagline.toLowerCase().includes(query)
      );
    }

    if (requirePrivacy) {
      result = result.filter((r) => r.privacyIncluded);
    }

    if (requireDnssec) {
      result = result.filter((r) => r.dnssecSupported);
    }

    // Sort options
    switch (sortOption) {
      case 'lowest-first-year':
        result.sort((a, b) => a.registrationPrice - b.registrationPrice);
        break;
      case 'lowest-renewal':
        result.sort((a, b) => a.renewalPrice - b.renewalPrice);
        break;
      case 'lowest-transfer':
        result.sort((a, b) => a.transferPrice - b.transferPrice);
        break;
      case 'lowest-5yr':
        result.sort((a, b) => {
          const costA = a.registrationPrice + 4 * a.renewalPrice;
          const costB = b.registrationPrice + 4 * b.renewalPrice;
          return costA - costB;
        });
        break;
      case 'best-value':
      default:
        result.sort((a, b) => b.score - a.score);
        break;
    }

    return result;
  }, [baseRegistrars, filterText, requirePrivacy, requireDnssec, sortOption]);

  // Derived metrics & benchmarks
  const summaryMetrics = useMemo(() => calculatePricingSummary(baseRegistrars), [baseRegistrars]);

  const ownershipItems = useMemo(
    () => calculateOwnershipCosts(baseRegistrars, horizon),
    [baseRegistrars, horizon]
  );

  const selectedRegistrar = useMemo(() => {
    return (
      baseRegistrars.find((r) => r.id === selectedRegistrarId) ||
      baseRegistrars[0] ||
      baseRegistrars[1]
    );
  }, [baseRegistrars, selectedRegistrarId]);

  const handleSaveToWatchlist = (reg: RegistrarPricing) => {
    const newItem: SavedComparisonItem = {
      id: `sc-${Date.now()}`,
      title: `${selectedTld} ${reg.registrarName} Benchmark`,
      tld: selectedTld,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      topPick: reg.registrarName,
      est5YrSavings: `₹${(reg.renewalPrice * 2).toLocaleString('en-IN')}/domain`,
    };
    setSavedComparisons((prev) => [newItem, ...prev]);
  };

  const handleRemoveSaved = (id: string) => {
    setSavedComparisons((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="flex flex-col gap-unit-md w-full pb-unit-2xl">
      {/* 1. TOP REFERENCE DISCLAIMER BANNER */}
      <PricingDisclaimer />

      {/* Domain Context Callout if query param is passed from Find Domain and in Registrars mode */}
      {mode === 'registrars' && domainParam && (
        <div className="px-unit-base py-2 rounded-lg bg-secondary-container/40 flex items-center justify-between gap-unit-sm border border-secondary-container">
          <div className="flex items-center gap-unit-xs text-caption-xs font-caption-xs">
            <span className="material-symbols-outlined text-primary text-[18px]">travel_explore</span>
            <span className="text-secondary">Comparing Multi-Registrar Pricing for:</span>
            <span className="font-label-mono font-bold text-primary text-body-sm">
              {domainParam}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-secondary-container text-primary font-semibold text-[10px]">
              {selectedTld} Active
            </span>
          </div>
          <span className="text-caption-xs text-secondary italic hidden sm:inline">
            Reference dataset derived from {selectedTld} zone benchmarks
          </span>
        </div>
      )}

      {/* 2. PAGE HEADER & PRIMARY CONTROLS */}
      <PricingHeader
        mode={mode}
        onModeChange={setMode}
        savedCount={savedComparisons.length}
        onOpenSaved={() => setShowSavedModal(true)}
        onOpenMethodology={() => setShowMethodologyModal(true)}
      />

      {/* 3. VIEW: REGISTRARS MODE (DEFAULT) */}
      {mode === 'registrars' && (
        <div className="flex flex-col gap-unit-md">
          {/* TOOLBAR & TLD SELECTOR */}
          <TldPricingFilters
            selectedTld={selectedTld}
            onSelectTld={setSelectedTld}
            sortOption={sortOption}
            onSortChange={setSortOption}
            filterText={filterText}
            onFilterTextChange={setFilterText}
            requirePrivacy={requirePrivacy}
            onTogglePrivacy={() => setRequirePrivacy(!requirePrivacy)}
            requireDnssec={requireDnssec}
            onToggleDnssec={() => setRequireDnssec(!requireDnssec)}
          />

          {/* COMPACT METRIC SUMMARY STRIP */}
          <PricingSummaryStrip metrics={summaryMetrics} tld={selectedTld} />

          {/* 5-YEAR OWNERSHIP VISUALIZATION & BENCHMARK DUAL CARD */}
          <OwnershipCostBenchmark
            items={ownershipItems}
            horizon={horizon}
            onHorizonChange={setHorizon}
            tld={selectedTld}
          />

          {/* MAIN DATA MATRIX & PROVIDER INSPECTION DRAWER (SPLIT VIEW) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-unit-md items-start">
            {/* Matrix Table (Left 8 Cols) */}
            <div className="xl:col-span-8">
              <RegistrarComparisonMatrix
                registrars={filteredRegistrars}
                selectedRegistrarId={selectedRegistrarId}
                onSelectRegistrar={setSelectedRegistrarId}
                selectedTld={selectedTld}
              />
            </div>

            {/* Provider Details Drawer (Right 4 Cols) */}
            <div className="xl:col-span-4">
              <PricingInspector
                registrar={selectedRegistrar}
                onSaveToWatchlist={handleSaveToWatchlist}
              />
            </div>
          </div>

          {/* TRANSFER SAVINGS CALCULATOR (BOTTOM GRID) */}
          <TransferSavingsCalculator registrars={baseRegistrars} tld={selectedTld} />
        </div>
      )}

      {/* 4. VIEW: HOSTING PROVIDERS MODE */}
      {mode === 'hosting' && <HostingPricingMatrix />}

      {/* Saved Comparisons Modal */}
      {showSavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-unit-lg shadow-xl border border-outline-variant/30 flex flex-col gap-unit-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-unit-xs">
                <span className="material-symbols-outlined text-primary text-[20px]">bookmark</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Saved Pricing Comparisons ({savedComparisons.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSavedModal(false)}
                className="p-1 rounded text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-unit-xs max-h-80 overflow-y-auto">
              {savedComparisons.length > 0 ? (
                savedComparisons.map((sc) => (
                  <div
                    key={sc.id}
                    className="p-unit-sm rounded-lg bg-surface-container-low flex items-center justify-between border border-outline-variant/20 hover:bg-surface-container transition-colors"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-label-mono font-bold text-on-surface text-body-sm truncate">
                          {sc.title}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-secondary-container text-primary font-caption-xs text-[10px] font-semibold">
                          {sc.tld}
                        </span>
                      </div>
                      <span className="text-caption-xs text-secondary mt-0.5">
                        Top Pick: {sc.topPick} • {sc.est5YrSavings} • {sc.date}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTld(sc.tld);
                          setShowSavedModal(false);
                        }}
                        className="px-2 py-1 rounded bg-surface-container text-primary hover:bg-primary hover:text-on-primary text-caption-xs font-semibold transition-colors cursor-pointer"
                      >
                        Load TLD
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSaved(sc.id)}
                        className="p-1 text-secondary hover:text-rose-600 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-secondary text-body-sm">
                  No saved comparisons in your list.
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowSavedModal(false)}
              className="h-9 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface font-label-md text-label-md font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Methodology Modal */}
      {showMethodologyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-xl w-full p-unit-lg shadow-xl border border-outline-variant/30 flex flex-col gap-unit-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-unit-xs">
                <span className="material-symbols-outlined text-secondary text-[20px]">balance</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Benchmark &amp; Methodology Guide
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMethodologyModal(false)}
                className="p-1 rounded text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-unit-sm text-body-sm text-secondary leading-relaxed">
              <p>
                <strong>5-Year Cumulative Cost Trajectory:</strong> Calculated using the initial registration rate plus 4 consecutive annual renewal rates:
                <code className="block p-2 bg-surface-container-low rounded my-1 font-label-mono text-[12px] text-on-surface">
                  5-Yr Cost = Year_1_Registration + (4 × Recurring_Renewal_Rate)
                </code>
              </p>
              <p>
                <strong>Wholesale At-Cost Pricing:</strong> Cloudflare Registrar offers domains at ICANN registry wholesale rates ($0 markup). Other registrars apply variable markups, intro promotions, or renewal escalations.
              </p>
              <p>
                <strong>Reference Dataset:</strong> All pricing and fee data is stored for benchmarking and demonstrative analysis. Final billing terms must be verified directly with the individual registrar.
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
