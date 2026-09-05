import React from 'react';

interface AccountsEmptyStateProps {
  onReset: () => void;
}

export const AccountsEmptyState: React.FC<AccountsEmptyStateProps> = ({ onReset }) => {
  return (
    <div className="p-unit-2xl rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-center flex flex-col items-center justify-center gap-unit-sm">
      <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-outline">
        <span className="material-symbols-outlined text-[28px]">search_off</span>
      </div>
      <div className="flex flex-col gap-1 max-w-sm">
        <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
          No Accounts or Emails Found
        </h3>
        <p className="font-body-sm text-body-sm text-secondary">
          No provider accounts or email groups match your search query or filter selection.
        </p>
      </div>
      <button
        onClick={onReset}
        className="mt-unit-xs h-8 px-unit-md rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors border border-outline-variant/30"
        type="button"
      >
        Reset Filters
      </button>
    </div>
  );
};
