import React from 'react';
import { WatchlistItem, DomainAvailabilityStatus } from '../findDomain.types';

interface WatchlistSectionProps {
  watchlist: WatchlistItem[];
  onInspect: (domain: string, status: DomainAvailabilityStatus) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

export const WatchlistSection: React.FC<WatchlistSectionProps> = ({
  watchlist,
  onInspect,
  onRemove,
  onClearAll,
}) => {
  return (
    <div
      id="saved-watchlist-widget"
      className="bg-surface-container-lowest rounded-xl shadow-sm p-unit-md flex flex-col gap-unit-sm border border-outline-variant/30"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-unit-xs">
          <span className="material-symbols-outlined text-primary text-[18px]">bookmarks</span>
          <span className="font-headline-sm text-body-lg font-semibold text-on-surface">
            Saved Watchlist
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary">
            ({watchlist.length})
          </span>
        </div>
        {watchlist.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-caption-xs font-caption-xs text-secondary hover:text-rose-700 cursor-pointer"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="flex flex-col gap-unit-xs font-caption-xs text-caption-xs">
        {watchlist.length > 0 ? (
          watchlist.map((item) => (
            <div
              key={item.id}
              className="p-2 rounded-lg bg-surface-container-low flex items-center justify-between group border border-outline-variant/20 hover:bg-surface-container transition-colors"
            >
              <div className="flex items-center gap-unit-xs min-w-0">
                <span className="material-symbols-outlined text-[14px] text-emerald-600 shrink-0">
                  check_circle
                </span>
                <div className="min-w-0">
                  <div className="font-label-mono font-bold text-on-surface truncate">
                    {item.domain}
                  </div>
                  <div className="text-secondary text-[10px] truncate">{item.priceFormatted}</div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onInspect(item.domain, item.status)}
                  className="px-2 py-0.5 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface text-[11px] transition-colors cursor-pointer"
                >
                  Inspect
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="p-1 text-secondary hover:text-rose-600 transition-colors cursor-pointer"
                  title="Remove from Saved"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-4 text-center text-secondary text-caption-xs">
            No saved domains in your list.
          </div>
        )}
      </div>
    </div>
  );
};
