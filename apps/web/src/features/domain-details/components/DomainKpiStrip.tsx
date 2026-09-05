import React from 'react';
import { DomainDetailData } from '../domainDetails.types';

interface DomainKpiStripProps {
  data: DomainDetailData;
}

export const DomainKpiStrip: React.FC<DomainKpiStripProps> = ({ data }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-unit-md mb-unit-lg">
      {/* Card 1: Registrar Entity */}
      <div className="bg-surface-container-lowest rounded-xl p-unit-md shadow-sm flex flex-col justify-between border border-outline-variant/30">
        <div>
          <div className="flex items-center justify-between mb-unit-xs">
            <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
              Registrar Entity
            </span>
            <span className="px-unit-xs py-unit-2xs rounded bg-surface-container text-primary font-caption-xs text-caption-xs font-semibold flex items-center gap-1 border border-outline-variant/20">
              <span className="material-symbols-outlined text-[11px]">sync</span> RDAP Retrieved
            </span>
          </div>
          <div className="font-headline-sm text-headline-sm text-on-surface font-bold">
            {data.registrarName}
          </div>
          <div className="font-caption-xs text-caption-xs text-on-surface-variant mt-unit-2xs flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>Tenant: {data.registrarTenant}</span>
          </div>
        </div>
        <div className="mt-unit-md pt-unit-xs bg-surface-container-low/60 rounded-lg p-unit-xs flex items-center justify-between text-on-surface-variant font-caption-xs text-caption-xs border border-outline-variant/20">
          <span>IANA Reference</span>
          <span className="font-label-mono text-label-mono font-medium text-on-surface">
            ID: {data.ianaId}
          </span>
        </div>
      </div>

      {/* Card 2: Registrant Account */}
      <div className="bg-surface-container-lowest rounded-xl p-unit-md shadow-sm flex flex-col justify-between border border-outline-variant/30">
        <div>
          <div className="flex items-center justify-between mb-unit-xs">
            <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
              Registrant Account
            </span>
            <span className="px-unit-xs py-unit-2xs rounded bg-secondary-container text-on-secondary-fixed font-caption-xs text-caption-xs font-medium">
              User Mapped
            </span>
          </div>
          <div className="font-body-lg text-body-lg text-on-surface font-semibold font-label-mono truncate" title={data.registrantEmail}>
            {data.registrantEmail}
          </div>
          <div className="font-caption-xs text-caption-xs text-on-surface-variant mt-unit-2xs flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-tertiary">privacy_tip</span>
            <span>{data.whoisRedacted ? 'WHOIS Redaction Active' : 'WHOIS Public'}</span>
          </div>
        </div>
        <div className="mt-unit-md pt-unit-xs bg-surface-container-low/60 rounded-lg p-unit-xs flex items-center justify-between text-on-surface-variant font-caption-xs text-caption-xs border border-outline-variant/20">
          <span>Source</span>
          <span className="text-tertiary font-medium">User Mapped</span>
        </div>
      </div>

      {/* Card 3: Expiry & Lifespan */}
      <div className="bg-surface-container-lowest rounded-xl p-unit-md shadow-sm flex flex-col justify-between border border-outline-variant/30">
        <div>
          <div className="flex items-center justify-between mb-unit-xs">
            <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
              Term Expiration
            </span>
            <span
              className={`px-unit-xs py-unit-2xs rounded font-caption-xs text-caption-xs font-semibold ${
                data.autoRenew
                  ? 'bg-[#ecfdf5] text-[#065f46]'
                  : 'bg-error-container/40 text-error'
              }`}
            >
              {data.autoRenew ? 'Auto-Renew: User Mapped On' : 'Auto-Renew: User Mapped Off'}
            </span>
          </div>
          <div className="flex items-baseline gap-unit-xs">
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
              {data.expiresFormatted}
            </span>
            <span
              className={`font-caption-xs text-caption-xs ${
                data.daysRemaining <= 7
                  ? 'text-error font-bold'
                  : data.daysRemaining <= 30
                  ? 'text-amber-700 font-medium'
                  : 'text-on-surface-variant'
              }`}
            >
              {data.daysRemaining} days remaining
            </span>
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 mt-unit-sm overflow-hidden">
            <div
              className={`h-full rounded-full ${
                data.daysRemaining <= 7
                  ? 'bg-error'
                  : data.daysRemaining <= 30
                  ? 'bg-amber-500'
                  : 'bg-primary'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, data.lifespanPercentage))}%` }}
            />
          </div>
        </div>
        <div className="mt-unit-md pt-unit-xs bg-surface-container-low/60 rounded-lg p-unit-xs flex items-center justify-between text-on-surface-variant font-caption-xs text-caption-xs border border-outline-variant/20">
          <span>Registered</span>
          <span className="font-label-mono text-label-mono font-medium text-on-surface">
            {data.registeredDateFormatted}
          </span>
        </div>
      </div>

      {/* Card 4: Renewal Financials */}
      <div className="bg-surface-container-lowest rounded-xl p-unit-md shadow-sm flex flex-col justify-between border border-outline-variant/30">
        <div>
          <div className="flex items-center justify-between mb-unit-xs">
            <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
              Estimated Annual Renewal
            </span>
            <span className="px-unit-xs py-unit-2xs rounded bg-surface-container-high text-on-surface-variant font-caption-xs text-caption-xs border border-outline-variant/20">
              Pricing Source: Stored
            </span>
          </div>
          <div className="flex items-baseline gap-unit-xs">
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
              {data.renewalCostFormatted}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary">/ yr</span>
          </div>
          <div className="font-caption-xs text-caption-xs text-on-surface-variant mt-unit-2xs">
            Estimated Renewal Rate
          </div>
        </div>
        <div className="mt-unit-md pt-unit-xs bg-surface-container-low/60 rounded-lg p-unit-xs flex items-center justify-between text-on-surface-variant font-caption-xs text-caption-xs border border-outline-variant/20">
          <span>5-Year Projection</span>
          <span className="font-label-mono text-label-mono font-semibold text-primary">
            {data.fiveYearProjectionFormatted}
          </span>
        </div>
      </div>
    </div>
  );
};
