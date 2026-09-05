import React, { useState } from 'react';
import { RegistrarPricing } from '../pricing.types';

interface PricingInspectorProps {
  registrar: RegistrarPricing;
  onSaveToWatchlist?: (registrar: RegistrarPricing) => void;
  onCompare?: (registrar: RegistrarPricing) => void;
}

export const PricingInspector: React.FC<PricingInspectorProps> = ({
  registrar,
  onSaveToWatchlist,
  onCompare,
}) => {
  const [isSaved, setIsSaved] = useState(false);
  const [showVisitNotice, setShowVisitNotice] = useState(false);

  // Derived 3-year and 5-year calculations
  const threeYearTotal = registrar.registrationPrice + 2 * registrar.renewalPrice;
  const fiveYearTotal = registrar.registrationPrice + 4 * registrar.renewalPrice;

  const handleToggleSave = () => {
    setIsSaved(!isSaved);
    if (onSaveToWatchlist) onSaveToWatchlist(registrar);
  };

  const handleVisit = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowVisitNotice(true);
    setTimeout(() => setShowVisitNotice(false), 3000);
  };

  return (
    <div className="p-unit-base rounded-lg bg-surface-container-lowest shadow-micro flex flex-col gap-unit-md border border-outline-variant/30">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-unit-sm">
          <div className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">
              {registrar.icon}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
              {registrar.registrarName}
            </h3>
            <p className="font-caption-xs text-caption-xs text-secondary truncate">
              {registrar.tagline}
            </p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-caption-xs text-caption-xs font-semibold shrink-0">
          Provider Details
        </span>
      </div>

      {/* Pricing Information 3-pack */}
      <div className="flex flex-col gap-unit-xs">
        <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
          Pricing Information ({registrar.tld})
        </span>
        <div className="grid grid-cols-3 gap-unit-xs p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
          <div className="flex flex-col text-center">
            <span className="font-caption-xs text-caption-xs text-secondary">Reg (Yr 1)</span>
            <span className="font-label-mono text-label-mono font-bold text-on-surface mt-0.5">
              {registrar.registrationFormatted}
            </span>
          </div>
          <div className="flex flex-col text-center">
            <span className="font-caption-xs text-caption-xs text-secondary">Renewal/Yr</span>
            <span className="font-label-mono text-label-mono font-bold text-on-surface mt-0.5">
              {registrar.renewalFormatted}
            </span>
          </div>
          <div className="flex flex-col text-center">
            <span className="font-caption-xs text-caption-xs text-secondary">Transfer</span>
            <span className="font-label-mono text-label-mono font-bold text-primary mt-0.5">
              {registrar.transferFormatted}
            </span>
          </div>
        </div>

        {/* Projected Totals */}
        <div className="flex items-center justify-between px-unit-sm py-unit-xs rounded bg-surface-container text-body-sm font-body-sm">
          <span className="text-secondary text-caption-xs">3-Year Projected Total:</span>
          <span className="font-label-mono text-label-mono font-semibold text-on-surface">
            ₹{threeYearTotal.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="flex items-center justify-between px-unit-sm py-unit-xs rounded bg-surface-container text-body-sm font-body-sm">
          <span className="text-secondary text-caption-xs">5-Year Projected Total:</span>
          <span className="font-label-mono text-label-mono font-semibold text-primary">
            ₹{fiveYearTotal.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Features & Safeguards */}
      <div className="flex flex-col gap-unit-xs">
        <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
          Features &amp; Safeguards
        </span>
        <div className="flex items-center justify-between text-body-sm font-body-sm py-0.5 border-b border-surface-container/50">
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-primary">shield</span>
            <span className="text-caption-xs">WHOIS Privacy</span>
          </div>
          <span
            className={`font-semibold text-caption-xs ${
              registrar.privacyIncluded ? 'text-primary' : 'text-rose-700'
            }`}
          >
            {registrar.privacyLabel}
          </span>
        </div>
        <div className="flex items-center justify-between text-body-sm font-body-sm py-0.5 border-b border-surface-container/50">
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-primary">lock</span>
            <span className="text-caption-xs">SSL Certificate</span>
          </div>
          <span className="text-caption-xs text-on-surface font-medium">Available</span>
        </div>
        <div className="flex items-center justify-between text-body-sm font-body-sm py-0.5">
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-primary">verified_user</span>
            <span className="text-caption-xs">DNSSEC Validation</span>
          </div>
          <span
            className={`text-caption-xs font-medium ${
              registrar.dnssecSupported ? 'text-primary font-semibold' : 'text-secondary'
            }`}
          >
            {registrar.dnssecSupported ? 'Supported' : 'Optional Add-on'}
          </span>
        </div>
      </div>

      {/* Reference Information */}
      <div className="flex flex-col gap-unit-xs">
        <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
          Reference Information
        </span>
        <div className="flex items-center justify-between text-body-sm font-body-sm py-0.5 border-b border-surface-container/50">
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-primary">payments</span>
            <span className="text-caption-xs">Supported Payments</span>
          </div>
          <span className="text-caption-xs text-on-surface truncate max-w-[180px]">
            {registrar.supportedPayments}
          </span>
        </div>
        <div className="flex items-center justify-between text-body-sm font-body-sm py-0.5">
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-primary">support_agent</span>
            <span className="text-caption-xs">Support Channels</span>
          </div>
          <span className="text-caption-xs text-on-surface truncate max-w-[180px]">
            {registrar.supportChannels}
          </span>
        </div>
      </div>

      {/* Action Buttons & Notice */}
      <div className="flex flex-col gap-unit-xs mt-auto pt-unit-xs">
        {showVisitNotice && (
          <div className="p-2 rounded bg-surface-container text-caption-xs text-secondary text-center animate-fade-in border border-outline-variant/20">
            External reference preview for {registrar.registrarName}. No redirect performed.
          </div>
        )}

        <button
          type="button"
          onClick={handleVisit}
          className="h-9 px-unit-md flex items-center justify-center gap-unit-xs rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-sm cursor-pointer"
        >
          <span>Visit Provider (Reference)</span>
          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
        </button>

        <div className="grid grid-cols-2 gap-unit-xs">
          <button
            type="button"
            onClick={() => onCompare && onCompare(registrar)}
            className="h-8 px-unit-sm rounded bg-surface-container text-on-surface font-caption-xs text-caption-xs hover:bg-surface-container-high transition-colors text-center cursor-pointer font-medium"
          >
            Compare Provider
          </button>
          <button
            type="button"
            onClick={handleToggleSave}
            className={`h-8 px-unit-sm rounded font-caption-xs text-caption-xs transition-colors text-center cursor-pointer font-medium ${
              isSaved
                ? 'bg-secondary-container text-primary'
                : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
            }`}
          >
            {isSaved ? 'Saved in Watchlist' : 'Save to Watchlist'}
          </button>
        </div>

        <p className="font-caption-xs text-[10px] text-secondary text-center mt-1">
          External reference link. DomainPulse receives no commission on transfers.
        </p>
      </div>
    </div>
  );
};
