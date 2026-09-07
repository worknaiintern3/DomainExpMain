import React from 'react';
import { DomainDiscoverySettings } from '../../settings.types';
import { AVAILABLE_TLDS } from '../../settings.reference';

interface DomainDiscoveryTabProps {
  settings: DomainDiscoverySettings;
  onChange: (updated: Partial<DomainDiscoverySettings>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const DomainDiscoveryTab: React.FC<DomainDiscoveryTabProps> = ({
  settings,
  onChange,
  onSave,
  isSaving,
}) => {
  const toggleTld = (tld: string) => {
    const exists = settings.defaultCheckedTlds.includes(tld);
    if (exists) {
      onChange({
        defaultCheckedTlds: settings.defaultCheckedTlds.filter((t) => t !== tld),
      });
    } else {
      onChange({
        defaultCheckedTlds: [...settings.defaultCheckedTlds, tld],
      });
    }
  };

  return (
    <section className="flex flex-col gap-unit-lg">
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30">
        <div className="flex flex-col pb-unit-md border-b border-surface-container-low">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Domain Discovery Preferences
            </h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-secondary font-caption-xs text-caption-xs font-mono border border-outline-variant/30">
              <span>Source: Reference Dataset</span>
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Default target extensions, discovery algorithms, and registrar benchmark rules for the query engine.
          </p>
        </div>

        <div className="flex flex-col gap-unit-md mt-unit-md">
          {/* Default Checked TLDs multi-select chip group */}
          <div className="flex flex-col gap-unit-xs">
            <div className="flex items-center justify-between">
              <label className="font-label-md text-label-md text-on-surface font-medium">
                Default Checked Extensions (TLDs)
              </label>
              <span className="font-caption-xs text-caption-xs text-secondary font-mono">
                {settings.defaultCheckedTlds.length} selected
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {AVAILABLE_TLDS.map((tld) => {
                const isSelected = settings.defaultCheckedTlds.includes(tld);
                return (
                  <button
                    key={tld}
                    type="button"
                    onClick={() => toggleTld(tld)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-label-mono text-label-mono font-medium transition-colors cursor-pointer border ${
                      isSelected
                        ? 'bg-surface-container text-primary border-primary/40 shadow-micro font-semibold'
                        : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                        isSelected ? 'bg-primary text-on-primary' : 'border border-outline-variant/60'
                      }`}
                    >
                      {isSelected ? '✓' : ''}
                    </span>
                    <span>{tld}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Discovery Mode & Availability Source */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md pt-unit-xs">
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface font-medium">
                Default Discovery Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ defaultDiscoveryMode: 'reference-preview' })}
                  className={`p-2.5 rounded-lg font-label-md text-label-md flex items-center justify-between border cursor-pointer transition-colors ${
                    settings.defaultDiscoveryMode === 'reference-preview'
                      ? 'bg-surface-container text-primary font-semibold border-primary/40 shadow-micro'
                      : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container'
                  }`}
                >
                  <span>Reference Preview</span>
                  {settings.defaultDiscoveryMode === 'reference-preview' && (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ defaultDiscoveryMode: 'compact' })}
                  className={`p-2.5 rounded-lg font-label-md text-label-md flex items-center justify-between border cursor-pointer transition-colors ${
                    settings.defaultDiscoveryMode === 'compact'
                      ? 'bg-surface-container text-primary font-semibold border-primary/40 shadow-micro'
                      : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container'
                  }`}
                >
                  <span>Compact List</span>
                  {settings.defaultDiscoveryMode === 'compact' && (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  )}
                </button>
              </div>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Display density for search results and availability cards.
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface font-medium">
                Default Registrar Comparison
              </label>
              <select
                value={settings.defaultRegistrarComparison}
                onChange={(e) =>
                  onChange({
                    defaultRegistrarComparison: e.target.value as any,
                  })
                }
                className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/40 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-micro cursor-pointer"
              >
                <option value="best-value">Best Long-Term Value</option>
                <option value="renewal-first">Renewal Rate First</option>
                <option value="lowest-initial">Lowest Initial Registration</option>
              </select>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Primary ranking sorting algorithm in registrar benchmark tables.
              </span>
            </div>
          </div>

          {/* Search History & Smart Variations */}
          <div className="space-y-unit-sm pt-unit-xs">
            <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  Saved Search History
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary">
                  Retain recent domain queries and comparison sessions in local storage.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.savedSearchHistory}
                  onChange={(e) => onChange({ savedSearchHistory: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 peer-checked:bg-primary transition-all"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  Smart Name Variations &amp; Synonyms
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary">
                  Generates intelligent prefix, suffix, and compound domain suggestions.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.smartNameVariations}
                  onChange={(e) => onChange({ smartNameVariations: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 peer-checked:bg-primary transition-all"></div>
              </label>
            </div>
          </div>

          {/* Preferred Suggestion Style */}
          <div className="flex flex-col gap-unit-xs pt-unit-xs">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Preferred Suggestion Style
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'brandable', label: 'Brandable' },
                { id: 'short', label: 'Short & Punchy' },
                { id: 'modern', label: 'Modern' },
                { id: 'tech', label: 'Tech-Focused' },
              ].map((style) => {
                const isSelected = settings.preferredSuggestionStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        preferredSuggestionStyle: style.id as any,
                      })
                    }
                    className={`flex items-center justify-center p-2.5 rounded-lg font-label-md text-label-md cursor-pointer transition-colors border ${
                      isSelected
                        ? 'bg-surface-container text-primary font-semibold border-primary/40 shadow-micro'
                        : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <span>{style.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Disclosure Callout */}
          <div className="p-unit-md rounded-xl bg-surface-container-high/40 border border-outline-variant/30 flex items-start gap-3">
            <span className="material-symbols-outlined text-[20px] text-tertiary shrink-0 mt-0.5">
              info
            </span>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Domain Discovery Notice
              </span>
              <p className="font-body-sm text-body-sm text-secondary mt-0.5">
                Live registry availability will require a connected registry or registrar integration.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-unit-lg pt-unit-md border-t border-surface-container-low flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Discovery Settings'}
          </button>
        </div>
      </div>
    </section>
  );
};
