import React from 'react';
import { SaveState } from '../settings.types';

interface SettingsHeaderProps {
  saveState: SaveState;
  onSave: () => void;
  onResetDefaults: () => void;
  currencyCode: string;
  densityLabel: string;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({
  saveState,
  onSave,
  onResetDefaults,
  currencyCode,
  densityLabel,
}) => {
  const renderSavePill = () => {
    switch (saveState) {
      case 'saved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-caption-xs text-caption-xs font-mono border border-outline-variant/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Saved</span>
          </span>
        );
      case 'unsaved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 font-caption-xs text-caption-xs font-mono border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Unsaved Changes</span>
          </span>
        );
      case 'saving':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-caption-xs text-caption-xs font-mono border border-primary/30">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            <span>Saving...</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container font-caption-xs text-caption-xs font-mono border border-error/30">
            <span className="w-1.5 h-1.5 rounded-full bg-error" />
            <span>Save Failed</span>
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-unit-md pb-unit-lg border-b border-surface-container-high/80">
      <div className="flex flex-col">
        <div className="flex items-center gap-unit-sm">
          <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight font-semibold">
            Settings
          </h1>
          {renderSavePill()}
        </div>
        <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
          Configure portfolio preferences, domain discovery defaults, alerts, and application behavior.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-unit-sm">
        <div className="hidden sm:flex items-center gap-unit-xs px-2.5 py-1 rounded-lg bg-surface-container-low text-secondary font-label-mono text-label-mono border border-outline-variant/30">
          <span className="material-symbols-outlined text-[15px] text-tertiary">folder_open</span>
          <span>Portfolio Workspace</span>
        </div>

        <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-low text-secondary font-label-md text-label-md border border-outline-variant/30">
          <span>{currencyCode}</span>
          <span className="text-outline">·</span>
          <span className="text-primary font-semibold capitalize">{densityLabel}</span>
        </div>

        <button
          type="button"
          onClick={onResetDefaults}
          className="h-9 px-unit-md inline-flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors shadow-micro border border-outline-variant/30 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">restart_alt</span>
          <span>Reset to Defaults</span>
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={saveState === 'saving'}
          className="h-9 px-unit-md inline-flex items-center gap-unit-xs rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">check</span>
          <span>{saveState === 'saving' ? 'Saving...' : 'Save Preferences'}</span>
        </button>
      </div>
    </div>
  );
};
