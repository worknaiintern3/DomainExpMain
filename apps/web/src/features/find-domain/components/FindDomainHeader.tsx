import React from 'react';

interface FindDomainHeaderProps {
  watchlistCount: number;
  onOpenWatchlist?: () => void;
}

export const FindDomainHeader: React.FC<FindDomainHeaderProps> = ({
  watchlistCount,
  onOpenWatchlist,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-unit-md pb-unit-xs">
      <div className="flex flex-col">
        <div className="flex items-center gap-unit-xs">
          <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight font-semibold">
            Find Domain
          </h1>
          <span className="px-unit-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-caption-xs text-caption-xs font-semibold uppercase tracking-wider">
            DOMAIN DISCOVERY
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
          Search, compare and discover the right domain across popular registries for your next project.
        </p>
      </div>

      {/* Quick Saved Watchlist Trigger Button */}
      <div className="flex items-center flex-wrap gap-unit-xs">
        <button
          type="button"
          onClick={onOpenWatchlist}
          className="flex items-center gap-unit-xs h-8 px-unit-sm rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors shadow-sm border border-outline-variant/30 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px] text-primary">bookmark</span>
          <span>Saved ({watchlistCount})</span>
        </button>
      </div>
    </div>
  );
};
