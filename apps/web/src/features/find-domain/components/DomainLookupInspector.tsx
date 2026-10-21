import React, { useState } from 'react';

import {
  AVAILABILITY_PROVIDER_LABELS,
  formatMinorUnits,
  type DomainAvailabilityResult,
} from '@/api/domain-search';
import { describeProviderReason } from '@/features/pricing/pricing.present';
import type { DomainAvailabilityStatus } from '../findDomain.types';

import { formatTime } from '@/lib/format';
interface DomainLiveInspectorProps {
  domain: string;
  status: DomainAvailabilityStatus;
  results: DomainAvailabilityResult[];
  requestError: string | null;
  onToggleWatchlist?: (domain: string) => void;
  isSaved?: boolean;
}

function stateBadge(state: DomainAvailabilityResult['state']): string {
  switch (state) {
    case 'AVAILABLE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
    case 'PREMIUM':
      return 'bg-blue-50 text-blue-800 border-blue-200/50';
    case 'UNAVAILABLE':
      return 'bg-rose-50 text-rose-700 border-rose-200/50';
    case 'UNCONFIGURED':
      return 'bg-surface-container text-secondary border-outline-variant/30';
    case 'ERROR':
    default:
      return 'bg-amber-50 text-amber-800 border-amber-200/50';
  }
}

function describeResult(result: DomainAvailabilityResult): string {
  switch (result.state) {
    case 'AVAILABLE':
      return result.definitive ? 'Available · live check' : 'Possibly available · verify with registrar';
    case 'PREMIUM':
      return 'Available · premium tier';
    case 'UNAVAILABLE':
      return describeProviderReason(result.reason) ?? 'Registered';
    case 'UNCONFIGURED':
      return 'Not configured';
    case 'ERROR':
    default:
      return result.errorCode ?? 'Check failed';
  }
}

export const DomainLookupInspector: React.FC<DomainLiveInspectorProps> = ({
  domain,
  status,
  results,
  requestError,
  onToggleWatchlist,
  isSaved,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const isAvailable = status === 'available';

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm p-unit-md flex flex-col gap-unit-md transition-all border border-outline-variant/30">
      {/* Inspector Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-unit-xs flex-wrap">
            <span className="font-headline-sm text-headline-sm text-on-surface font-label-mono truncate">
              {domain}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption-xs font-semibold border ${
                isAvailable
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                  : status === 'unknown'
                    ? 'bg-amber-50 text-amber-800 border-amber-200/50'
                    : 'bg-rose-50 text-rose-700 border-rose-200/50'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1 ${
                  isAvailable ? 'bg-emerald-500' : status === 'unknown' ? 'bg-amber-500' : 'bg-rose-500'
                }`}
              ></span>
              {isAvailable ? 'Available' : status === 'unknown' ? 'Unknown' : 'Registered'}
            </span>
          </div>
          <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
            Backend availability estimate · verify with a registrar
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
          {requestError && (
            <div className="p-unit-sm rounded-lg bg-amber-50 text-amber-900 font-caption-xs text-caption-xs flex items-start gap-unit-xs border border-amber-200/50">
              <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0 mt-0.5">
                schedule
              </span>
              <span>{requestError}</span>
            </div>
          )}

          {/* Per-provider breakdown */}
          <div className="rounded-lg bg-surface-container-low p-unit-sm flex flex-col gap-2 font-caption-xs text-caption-xs border border-outline-variant/20">
            {results.map((result) => {
              const registration = formatMinorUnits(
                result.registrationPriceMinorUnits,
                result.currency,
              );
              const renewal = formatMinorUnits(result.renewalPriceMinorUnits, result.currency);
              return (
                <div key={result.provider} className="flex flex-col gap-1 py-1 border-b border-surface-container last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-on-surface">
                      {AVAILABILITY_PROVIDER_LABELS[result.provider]}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold border ${stateBadge(result.state)}`}
                    >
                      {describeResult(result)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-secondary">
                    <span>
                      {registration
                        ? `Reg ${registration}${renewal ? ` · Ren ${renewal}` : ''}`
                        : 'No pricing returned'}
                    </span>
                    <span className="font-label-mono text-[10px]">
                      {result.definitive ? 'live' : result.state === 'UNCONFIGURED' ? '—' : 'cached'}
                      {' · '}
                      {formatTime(result.fetchedAt)}
                    </span>
                  </div>
                  {(result.tier || result.reason) && (
                    <div className="text-secondary text-[10px] font-label-mono truncate">
                      {[result.tier, describeProviderReason(result.reason)].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              );
            })}
            {results.length === 0 && !requestError && (
              <span className="text-secondary">No provider results for this domain yet.</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 gap-unit-xs pt-1">
            <button
              type="button"
              onClick={() => onToggleWatchlist && onToggleWatchlist(domain)}
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
              <span>{isSaved ? 'Saved in List' : 'Save Domain'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
