import React, { useState } from 'react';
import { SmartSuggestionItem, DomainAvailabilityStatus } from '../findDomain.types';
import { SYNTHESIZER_TONES, SYNTHESIZER_PRESETS } from '../findDomain.reference';

interface DomainSuggestionSectionProps {
  query: string;
  suggestions: SmartSuggestionItem[];
  onSelectDomain: (domain: string, status: DomainAvailabilityStatus) => void;
  onToggleWatchlist: (item: { domain: string; priceFormatted: string; registrarHint: string }) => void;
}

export const DomainSuggestionSection: React.FC<DomainSuggestionSectionProps> = ({
  query,
  suggestions,
  onSelectDomain,
  onToggleWatchlist,
}) => {
  const [selectedTone, setSelectedTone] = useState('Brandable');
  const [promptText, setPromptText] = useState(
    'AI-powered business automation and operations platform'
  );
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const activeToneChips = SYNTHESIZER_PRESETS[selectedTone] || SYNTHESIZER_PRESETS['Brandable'];

  const handleSynthesize = () => {
    setIsSynthesizing(true);
    setTimeout(() => {
      setIsSynthesizing(false);
    }, 450);
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm p-unit-md flex flex-col gap-unit-md border border-outline-variant/30">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-unit-xs">
          <span className="material-symbols-outlined text-primary text-[20px]">auto_awesome</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Smart Suggestions for '{query || 'worknai'}'
          </h2>
        </div>
        <span className="px-2 py-0.5 rounded text-caption-xs font-caption-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/50">
          {suggestions.length} Generated Alternatives
        </span>
      </div>

      {/* 3-Column Compact Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-unit-sm">
        {suggestions.map((sug) => (
          <div
            key={sug.id}
            className="p-unit-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-all flex flex-col justify-between gap-unit-xs shadow-xs border border-outline-variant/20"
          >
            <div className="flex items-center justify-between">
              <span className="font-label-mono font-semibold text-body-md text-on-surface truncate">
                {sug.domain}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Available"></span>
            </div>
            <div className="flex items-center justify-between text-caption-xs font-caption-xs text-secondary">
              <span className="truncate">{sug.registrarHint}</span>
              <span className="font-label-mono font-bold text-on-surface shrink-0">
                {sug.priceFormatted}
              </span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <button
                type="button"
                onClick={() => onSelectDomain(sug.domain, 'available')}
                className="flex-1 h-6 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface text-[11px] font-medium transition-colors cursor-pointer"
              >
                Compare
              </button>
              <button
                type="button"
                onClick={() => onToggleWatchlist(sug)}
                className={`w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
                  sug.isSaved
                    ? 'bg-secondary-container text-primary'
                    : 'bg-surface-container hover:bg-surface-variant text-secondary'
                }`}
                title={sug.isSaved ? 'Remove from Saved' : 'Save Domain'}
              >
                <span
                  className="material-symbols-outlined text-[14px]"
                  style={{
                    fontVariationSettings: sug.isSaved ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {sug.isSaved ? 'bookmark' : 'bookmark_border'}
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Integrated Name Synthesizer Container */}
      <div className="mt-unit-xs p-unit-md rounded-xl bg-surface-container flex flex-col gap-unit-sm border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-primary text-[18px]">psychology</span>
            <span className="font-headline-sm text-body-lg font-semibold text-on-surface">
              DomainPulse Name Synthesizer
            </span>
          </div>
          <span className="font-caption-xs text-caption-xs text-secondary">
            Generated Suggestions Preview
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-unit-sm items-center">
          <div className="md:col-span-8">
            <input
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Describe business or product keywords..."
              className="w-full h-9 px-unit-sm rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
            />
          </div>
          <div className="md:col-span-4 flex items-center justify-end">
            <button
              type="button"
              onClick={handleSynthesize}
              className="w-full h-9 px-unit-md rounded-lg bg-tertiary-container hover:bg-tertiary text-on-primary font-label-md text-label-md flex items-center justify-center gap-unit-xs transition-colors shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">electric_bolt</span>
              <span>Synthesize Names</span>
            </button>
          </div>
        </div>

        {/* Synthesis Tone Pills & Output Chips */}
        <div className="flex flex-wrap items-center justify-between gap-unit-xs pt-unit-2xs text-caption-xs font-caption-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-secondary select-none">Tone:</span>
            {SYNTHESIZER_TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                onClick={() => setSelectedTone(tone)}
                className={`px-2 py-0.5 rounded-full font-medium transition-colors cursor-pointer ${
                  selectedTone === tone
                    ? 'bg-secondary-container text-on-secondary-fixed font-semibold'
                    : 'bg-surface-container-lowest text-secondary hover:text-on-surface'
                }`}
              >
                {tone} {selectedTone === tone ? '✓' : ''}
              </button>
            ))}
          </div>

          {/* Output Chips */}
          <div className="flex flex-wrap items-center gap-1.5 font-label-mono">
            <span className="text-secondary text-[11px] font-sans">Synthesized:</span>
            {isSynthesizing ? (
              <span className="inline-flex items-center gap-1 text-primary text-[11px]">
                <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                <span>Generating...</span>
              </span>
            ) : (
              activeToneChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => onSelectDomain(chip.domain, 'available')}
                  className="px-2 py-0.5 rounded bg-surface-container-lowest text-on-surface text-[11px] hover:bg-surface-variant hover:text-primary transition-colors cursor-pointer border border-outline-variant/20"
                >
                  {chip.domain} <span className="text-emerald-700 font-bold">{chip.priceFormatted}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
