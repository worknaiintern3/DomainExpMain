import React, { useState } from 'react';
import { TldAvailabilityItem, DomainAvailabilityStatus } from '../findDomain.types';

interface TldAvailabilityResultsProps {
  items: TldAvailabilityItem[];
  selectedDomain: string;
  onSelectDomain: (domain: string, status: DomainAvailabilityStatus) => void;
  onToggleWatchlist: (item: TldAvailabilityItem) => void;
  onCompareRegistrars: (domain: string) => void;
}

export const TldAvailabilityResults: React.FC<TldAvailabilityResultsProps> = ({
  items,
  selectedDomain,
  onSelectDomain,
  onToggleWatchlist,
  onCompareRegistrars,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'available' | 'registered'>('all');

  const availableCount = items.filter((i) => i.status === 'available').length;
  const registeredCount = items.filter((i) => i.status === 'registered').length;

  const filteredItems = items.filter((item) => {
    if (filterType === 'available') return item.status === 'available';
    if (filterType === 'registered') return item.status === 'registered';
    return true;
  });

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/30">
      {/* Table Header / Filter Toolbar */}
      <div className="px-unit-md py-unit-sm bg-surface-container-low flex flex-wrap items-center justify-between gap-unit-xs border-b border-surface-container/50">
        <div className="flex items-center gap-unit-xs">
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Reference Availability &amp; Pricing Matrix
          </h2>
          <span className="text-caption-xs font-caption-xs text-secondary">
            ({items.length} Extensions)
          </span>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 bg-surface-container p-0.5 rounded-lg text-caption-xs font-caption-xs">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('available')}
            className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
              filterType === 'available'
                ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            Available ({availableCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('registered')}
            className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
              filterType === 'registered'
                ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            Registered ({registeredCount})
          </button>
        </div>
      </div>

      {/* 44px Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="h-8 bg-surface-container-low text-secondary font-caption-xs text-caption-xs uppercase tracking-wider select-none border-b border-surface-container/50">
              <th className="px-unit-md font-semibold">Domain</th>
              <th className="px-unit-sm font-semibold">Availability</th>
              <th className="px-unit-sm font-semibold">1st-Year Reg</th>
              <th className="px-unit-sm font-semibold">Renewal Cost</th>
              <th className="px-unit-sm font-semibold">Best Registrar</th>
              <th className="px-unit-md font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="font-body-sm text-body-sm divide-y divide-surface-container/40">
            {filteredItems.map((item) => {
              const isSelected = item.domain === selectedDomain;
              const isAvailable = item.status === 'available';

              return (
                <tr
                  key={item.id}
                  onClick={() => onSelectDomain(item.domain, item.status)}
                  className={`h-11 cursor-pointer transition-colors group ${
                    isSelected
                      ? 'bg-primary/5 hover:bg-primary/10'
                      : 'hover:bg-surface-container-low/70 bg-surface-container-lowest'
                  }`}
                >
                  {/* 1. Domain */}
                  <td className="px-unit-md">
                    <div className="flex items-center gap-unit-xs">
                      <span
                        className={`material-symbols-outlined text-[16px] ${
                          isAvailable ? 'text-emerald-600' : 'text-outline'
                        }`}
                      >
                        {isAvailable ? 'check_circle' : 'lock'}
                      </span>
                      <span
                        className={`font-label-mono font-semibold transition-colors ${
                          isSelected
                            ? 'text-primary'
                            : 'text-on-surface group-hover:text-primary'
                        }`}
                      >
                        {item.domain}
                      </span>
                      {item.topPickTag && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase bg-secondary-container text-primary">
                          {item.topPickTag}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 2. Availability */}
                  <td className="px-unit-sm">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption-xs font-semibold ${
                        isAvailable
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                          : 'bg-rose-50 text-rose-700 border border-rose-200/50'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          isAvailable ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      ></span>
                      {item.statusLabel}
                    </span>
                  </td>

                  {/* 3. 1st-Year Reg */}
                  <td
                    className={`px-unit-sm font-label-mono ${
                      isAvailable
                        ? 'font-bold text-on-surface'
                        : 'text-secondary'
                    }`}
                  >
                    {item.firstYearPriceFormatted || '—'}
                  </td>

                  {/* 4. Renewal Cost */}
                  <td className="px-unit-sm font-label-mono text-secondary">
                    {item.renewalPriceFormatted ? (
                      <span className="inline-flex items-center gap-1">
                        <span>{item.renewalPriceFormatted}</span>
                        {item.renewalHikeFormatted && (
                          <span
                            className={`text-[10px] font-sans font-medium ${
                              item.renewalHikeIsWarning
                                ? 'text-rose-700 font-semibold'
                                : 'text-amber-700'
                            }`}
                          >
                            {item.renewalHikeFormatted}
                          </span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>

                  {/* 5. Best Registrar */}
                  <td className="px-unit-sm">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-on-surface truncate">
                        {item.bestRegistrar}
                      </span>
                      {item.bestRegistrarBadge && (
                        <span className="text-[10px] text-emerald-700 font-semibold">
                          {item.bestRegistrarBadge}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 6. Actions */}
                  <td className="px-unit-md text-right">
                    <div
                      className="inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isAvailable ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectDomain(item.domain, 'available');
                              onCompareRegistrars(item.domain);
                            }}
                            className="h-7 px-2.5 rounded bg-primary text-on-primary font-caption-xs text-caption-xs font-semibold hover:bg-tertiary shadow-sm transition-colors cursor-pointer"
                          >
                            Compare
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleWatchlist(item)}
                            className={`w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer ${
                              item.isSaved
                                ? 'bg-secondary-container text-primary hover:bg-surface-container'
                                : 'bg-surface-container-low hover:bg-surface-container text-secondary hover:text-primary'
                            }`}
                            title={item.isSaved ? 'Remove from Saved' : 'Save Domain'}
                          >
                            <span
                              className="material-symbols-outlined text-[16px]"
                              style={{
                                fontVariationSettings: item.isSaved ? "'FILL' 1" : "'FILL' 0",
                              }}
                            >
                              {item.isSaved ? 'bookmark' : 'bookmark_border'}
                            </span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onSelectDomain(item.domain, 'registered')}
                            className="h-7 px-2.5 rounded bg-surface-container hover:bg-surface-variant text-on-surface font-caption-xs text-caption-xs font-semibold transition-colors cursor-pointer"
                          >
                            WHOIS Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleWatchlist(item)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container text-secondary hover:text-primary transition-colors cursor-pointer"
                            title="Track Domain"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              visibility
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-unit-md py-2 bg-surface-container-low text-caption-xs font-caption-xs text-secondary flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-surface-container/50">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] text-primary">task_alt</span>
            Click any row to inspect WHOIS details or view multi-registrar comparison.
          </span>
          <span className="text-[11px] text-outline italic">
            Reference/demo pricing. Actual registrar pricing may vary.
          </span>
        </div>
        <span className="font-label-mono text-[11px] shrink-0">
          Showing {filteredItems.length} of {items.length} extensions
        </span>
      </div>
    </div>
  );
};
