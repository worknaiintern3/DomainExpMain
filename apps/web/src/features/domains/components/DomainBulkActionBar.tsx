import React from 'react';

interface DomainBulkActionBarProps {
  selectedCount: number;
  selectedDomainNames: string[];
  onClearSelection: () => void;
}

export const DomainBulkActionBar: React.FC<DomainBulkActionBarProps> = ({
  selectedCount,
  selectedDomainNames,
  onClearSelection,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="w-full bg-inverse-surface text-inverse-on-surface rounded-xl shadow-lg px-unit-lg py-unit-sm flex flex-wrap items-center justify-between gap-unit-md transition-all duration-200 border border-slate-800 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-unit-md min-w-0">
        <div className="flex items-center justify-center w-6 h-6 rounded bg-primary text-on-primary font-label-mono text-caption-xs font-bold shrink-0">
          {selectedCount}
        </div>
        <span className="font-label-md text-label-md font-semibold text-inverse-on-surface">
          {selectedCount} {selectedCount === 1 ? 'domain' : 'domains'} selected
        </span>
        <span className="h-4 w-[1px] bg-secondary-fixed-dim/30 hidden md:inline" />
        <span className="font-caption-xs text-caption-xs text-secondary-fixed-dim hidden md:inline truncate max-w-md">
          {selectedDomainNames.slice(0, 3).join(', ')}
          {selectedDomainNames.length > 3 ? ` +${selectedDomainNames.length - 3} more` : ''}
        </span>
      </div>

      <div className="flex items-center gap-unit-xs flex-wrap">
        <button
          className="h-8 px-unit-sm flex items-center gap-1 rounded bg-inverse-surface hover:bg-white/10 text-inverse-on-surface font-label-md text-caption-xs transition-colors border border-white/10"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">label</span>
          <span>+ Add Tag</span>
        </button>

        <button
          className="h-8 px-unit-sm flex items-center gap-1 rounded bg-inverse-surface hover:bg-white/10 text-inverse-on-surface font-label-md text-caption-xs transition-colors border border-white/10"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">notifications_paused</span>
          <span>Set Reminder</span>
        </button>

        <button
          className="h-8 px-unit-sm flex items-center gap-1 rounded bg-inverse-surface hover:bg-white/10 text-inverse-on-surface font-label-md text-caption-xs transition-colors border border-white/10"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">sync</span>
          <span>Mark Auto-Renew On</span>
        </button>

        <button
          className="h-8 px-unit-sm flex items-center gap-1 rounded bg-inverse-surface hover:bg-white/10 text-inverse-on-surface font-label-md text-caption-xs transition-colors border border-white/10"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">ios_share</span>
          <span>Export Selected</span>
        </button>

        <button
          className="h-8 px-unit-sm flex items-center gap-1 rounded bg-error/20 hover:bg-error/30 text-error-container font-label-md text-caption-xs transition-colors ml-unit-xs border border-error/30"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">delete</span>
          <span>Delete ({selectedCount})</span>
        </button>

        <button
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-secondary-fixed-dim hover:text-inverse-on-surface transition-colors ml-1"
          onClick={onClearSelection}
          title="Deselect all"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  );
};
