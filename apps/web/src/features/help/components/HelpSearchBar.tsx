import React from 'react';

interface HelpSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onQuickSearch: (query: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}

const QUICK_CHIPS = [
  'How do I add a domain?',
  'What is RDAP?',
  'Why is a domain marked critical?',
  'How are renewal costs calculated?',
  'Why does Monitoring say Not Connected?',
];

export const HelpSearchBar: React.FC<HelpSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  onQuickSearch,
  inputRef,
}) => {
  return (
    <div className="w-full bg-surface-container-lowest rounded-xl p-unit-md shadow-micro border border-outline-variant/30 mb-unit-lg">
      <div className="flex flex-col md:flex-row items-stretch gap-unit-sm">
        <div className="relative flex-1 flex items-center">
          <span className="material-symbols-outlined absolute left-unit-sm text-secondary text-[20px] pointer-events-none">
            manage_search
          </span>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search help topics, FAQs, features, or troubleshooting..."
            className="w-full h-11 pl-10 pr-16 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm placeholder:text-secondary border border-outline-variant/40 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-micro"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-unit-sm text-secondary hover:text-on-surface text-[14px] px-1.5 py-0.5 rounded bg-surface-container font-label-mono cursor-pointer"
            >
              Clear
            </button>
          ) : (
            <span className="absolute right-unit-sm font-caption-xs text-caption-xs text-outline font-label-mono">
              Esc to clear
            </span>
          )}
        </div>
      </div>

      {/* Frequently Asked Query Chips */}
      <div className="flex flex-wrap items-center gap-unit-xs mt-unit-sm pt-unit-xs border-t border-surface-container-low">
        <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium mr-unit-2xs">
          Frequently Asked:
        </span>
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onQuickSearch(chip)}
            className="px-unit-sm py-unit-2xs rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-caption-xs text-caption-xs transition-colors cursor-pointer border border-outline-variant/20"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
};
