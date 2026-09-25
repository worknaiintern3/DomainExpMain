import React, { useState } from 'react';
import { DomainInspectionDetails } from '../findDomain.types';

interface DomainLookupInspectorProps {
  details: DomainInspectionDetails;
  onToggleWatchlist?: (domain: string) => void;
  isSaved?: boolean;
  onOpenFullWhois?: () => void;
}

export const DomainLookupInspector: React.FC<DomainLookupInspectorProps> = ({
  details,
  onToggleWatchlist,
  isSaved,
  onOpenFullWhois,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const isRegistered = details.status === 'registered';

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm p-unit-md flex flex-col gap-unit-md transition-all border border-outline-variant/30">
      {/* Inspector Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-unit-xs flex-wrap">
            <span className="font-headline-sm text-headline-sm text-on-surface font-label-mono truncate">
              {details.domain}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption-xs font-semibold ${
                isRegistered
                  ? 'bg-rose-50 text-rose-700 border border-rose-200/50'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1 ${
                  isRegistered ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              ></span>
              {details.statusBadgeText}
            </span>
          </div>
          <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
            Domain Registration &amp; DNS Information (Reference Preview)
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-secondary hover:text-on-surface p-1 rounded hover:bg-surface-container transition-colors cursor-pointer"
          title={isMinimized ? 'Expand' : 'Collapse'}
        >
          <span className="material-symbols-outlined text-[18px]">
            {isMinimized ? 'expand_more' : 'expand_less'}
          </span>
        </button>
      </div>

      {!isMinimized && (
        <div className="flex flex-col gap-unit-sm">
          {/* Metadata Grid */}
          <div className="rounded-lg bg-surface-container-low p-unit-sm flex flex-col gap-2 font-caption-xs text-caption-xs border border-outline-variant/20">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-secondary">Sponsoring Registrar</span>
              <span className="font-semibold text-on-surface truncate max-w-[200px]">
                {details.sponsoringRegistrar}
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-secondary">Registration Date</span>
              <span className="font-label-mono text-on-surface">
                {details.registrationDateFormatted || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-secondary">Expiration Date</span>
              <span className="font-label-mono font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/40">
                {details.expirationDateFormatted}
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-secondary">Last Registry Update</span>
              <span className="font-label-mono text-on-surface">
                {details.lastUpdateFormatted || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-secondary">Authoritative Nameservers</span>
              <span className="font-label-mono text-on-surface text-right truncate max-w-[180px]">
                {details.authoritativeNameservers.join(', ')}
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-secondary">DNSSEC Validation</span>
              <span className="font-medium text-on-surface flex items-center gap-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    details.dnssecStatus === 'signed' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                ></span>
                <span>{details.dnssecValidation}</span>
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-secondary">WHOIS Privacy</span>
              <span className="text-on-surface font-medium truncate max-w-[180px]">
                {details.whoisPrivacy}
              </span>
            </div>
            {details.registryDomainId && (
              <div className="flex items-center justify-between py-0.5">
                <span className="text-secondary">Registry Domain ID</span>
                <span className="font-label-mono text-[10px] text-secondary truncate max-w-[180px]">
                  {details.registryDomainId}
                </span>
              </div>
            )}
            {details.icannStatusFlags.length > 0 && (
              <div className="pt-1 flex flex-col gap-1 border-t border-surface-container">
                <span className="text-secondary">ICANN Status Flags:</span>
                <div className="flex flex-wrap gap-1">
                  {details.icannStatusFlags.map((flag, idx) => (
                    <span
                      key={idx}
                      className="font-label-mono text-[10px] bg-surface-container px-1.5 py-0.5 rounded text-on-surface"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Operational Warning / Notice */}
          {details.operationalNotice && (
            <div className="p-unit-sm rounded-lg bg-amber-50 text-amber-900 font-caption-xs text-caption-xs flex items-start gap-unit-xs border border-amber-200/50">
              <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0 mt-0.5">
                schedule
              </span>
              <span>{details.operationalNotice}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-unit-xs pt-1">
            <button
              type="button"
              onClick={onOpenFullWhois}
              className="h-8 px-2 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface font-label-md text-label-md flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">travel_explore</span>
              <span>Full WHOIS</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleWatchlist && onToggleWatchlist(details.domain)}
              className={`h-8 px-2 rounded-lg font-label-md text-label-md flex items-center justify-center gap-1 transition-colors shadow-sm cursor-pointer ${
                isSaved
                  ? 'bg-secondary-container text-primary hover:bg-surface-container'
                  : 'bg-primary text-on-primary hover:bg-tertiary'
              }`}
            >
              <span
                className="material-symbols-outlined text-[16px]"
                style={{ fontVariationSettings: isSaved ? "'FILL' 1" : "'FILL' 0" }}
              >
                {isSaved ? 'bookmark' : 'notifications_active'}
              </span>
              <span>{isSaved ? 'Saved in List' : isRegistered ? 'Watch Expiry' : 'Save Domain'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
