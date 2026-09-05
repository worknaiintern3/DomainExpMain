import React from 'react';
import { ProviderAccountKpis } from '../providerAccountDetails.types';

interface ProviderAccountKpiStripProps {
  kpis: ProviderAccountKpis;
}

export const ProviderAccountKpiStrip: React.FC<ProviderAccountKpiStripProps> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-unit-sm">
      {/* 1. Owned Servers */}
      <div className="p-unit-sm rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col justify-between">
        <span className="font-caption-xs text-caption-xs text-secondary font-medium tracking-wide uppercase">
          Owned Servers
        </span>
        <div className="flex items-baseline justify-between mt-unit-xs">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold">
            {kpis.ownedServersCount}
          </span>
          <span className="font-caption-xs text-caption-xs text-primary bg-primary-fixed/40 px-1.5 py-0.5 rounded font-medium">
            {kpis.ownedServersSubtext}
          </span>
        </div>
      </div>

      {/* 2. Hosted Websites */}
      <div className="p-unit-sm rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col justify-between">
        <span className="font-caption-xs text-caption-xs text-secondary font-medium tracking-wide uppercase">
          Hosted Websites
        </span>
        <div className="flex items-baseline justify-between mt-unit-xs">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold">
            {kpis.hostedWebsitesCount}
          </span>
          <span className="font-caption-xs text-caption-xs text-primary bg-primary-fixed/40 px-1.5 py-0.5 rounded font-medium">
            {kpis.hostedWebsitesSubtext}
          </span>
        </div>
      </div>

      {/* 3. Linked Domains */}
      <div className="p-unit-sm rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col justify-between">
        <span className="font-caption-xs text-caption-xs text-secondary font-medium tracking-wide uppercase">
          Linked Domains
        </span>
        <div className="flex items-baseline justify-between mt-unit-xs">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold">
            {kpis.linkedDomainsCount}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary font-mono">
            {kpis.linkedDomainsSubtext}
          </span>
        </div>
      </div>

      {/* 4. Estimated Monthly Cost */}
      <div className="p-unit-sm rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col justify-between">
        <span className="font-caption-xs text-caption-xs text-secondary font-medium tracking-wide uppercase">
          Estimated Monthly Cost
        </span>
        <div className="mt-unit-xs">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold">
            {kpis.estimatedMonthlyCostFormatted}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary block mt-0.5 font-mono">
            {kpis.estimatedMonthlyCostSubtext}
          </span>
        </div>
      </div>

      {/* 5. Estimated Annual Cost */}
      <div className="p-unit-sm rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col justify-between">
        <span className="font-caption-xs text-caption-xs text-secondary font-medium tracking-wide uppercase">
          Estimated Annual Cost
        </span>
        <div className="mt-unit-xs">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold">
            {kpis.estimatedAnnualCostFormatted}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary block mt-0.5 font-mono">
            {kpis.estimatedAnnualCostSubtext}
          </span>
        </div>
      </div>

      {/* 6. Next Renewal */}
      <div className="p-unit-sm rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col justify-between">
        <span className="font-caption-xs text-caption-xs text-secondary font-medium tracking-wide uppercase">
          Next Renewal
        </span>
        <div className="mt-unit-xs">
          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate block">
            {kpis.nextRenewalFormatted}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary block mt-0.5">
            {kpis.nextRenewalSubtext}
          </span>
        </div>
      </div>
    </div>
  );
};
