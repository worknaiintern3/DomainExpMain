import React from 'react';

interface SearchEmptyStateProps {
  onSelectPrompt: (keyword: string) => void;
}

export const SearchEmptyState: React.FC<SearchEmptyStateProps> = ({ onSelectPrompt }) => {
  return (
    <div className="flex flex-col items-center justify-center p-unit-2xl bg-surface-container-lowest rounded-xl shadow-sm text-center border border-outline-variant/30">
      <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-primary mb-unit-md shadow-inner">
        <span className="material-symbols-outlined text-[32px]">travel_explore</span>
      </div>
      <h3 className="font-headline-md text-headline-md text-on-surface mb-unit-xs font-semibold">
        Start a Domain Availability Search
      </h3>
      <p className="font-body-md text-body-md text-secondary max-w-md mb-unit-lg">
        Type a domain keyword, brand name, or full FQDN above to perform multi-TLD availability checks and reference pricing comparisons.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-unit-xs">
        <button
          type="button"
          onClick={() => onSelectPrompt('worknai')}
          className="px-unit-md py-1.5 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface font-label-md text-label-md transition-colors cursor-pointer"
        >
          Try "worknai"
        </button>
        <button
          type="button"
          onClick={() => onSelectPrompt('finpilot')}
          className="px-unit-md py-1.5 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface font-label-md text-label-md transition-colors cursor-pointer"
        >
          Try "finpilot"
        </button>
        <button
          type="button"
          onClick={() => onSelectPrompt('flowbase')}
          className="px-unit-md py-1.5 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface font-label-md text-label-md transition-colors cursor-pointer"
        >
          Try "flowbase"
        </button>
      </div>
    </div>
  );
};
