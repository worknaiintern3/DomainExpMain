import React, { useState } from 'react';
import { ServerDetailData } from '../serverDetails.types';

interface ServerKpiStripProps {
  data: ServerDetailData;
}

export const ServerKpiStrip: React.FC<ServerKpiStripProps> = ({ data }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyIp = () => {
    navigator.clipboard.writeText(data.ipAddress).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-unit-md mb-unit-lg">
      {/* 1. Cloud Provider */}
      <div className="p-unit-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-unit-sm border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase tracking-wider font-semibold">
            Cloud Provider
          </span>
          <span className="material-symbols-outlined text-[18px] text-primary">cloud_done</span>
        </div>
        <div className="flex flex-col">
          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            {data.provider}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary">
            {data.providerAccountName}
          </span>
        </div>
        <div className="pt-unit-xs">
          <span className="inline-flex items-center gap-1.5 px-unit-sm py-unit-2xs rounded bg-surface-container text-on-surface font-caption-xs text-caption-xs font-label-mono border border-outline-variant/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>Provider Stored</span>
          </span>
        </div>
      </div>

      {/* 2. Account Identity */}
      <div className="p-unit-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-unit-sm border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase tracking-wider font-semibold">
            Account Identity
          </span>
          <span className="material-symbols-outlined text-[18px] text-primary">badge</span>
        </div>
        <div className="flex flex-col gap-unit-2xs">
          <div className="inline-flex items-center gap-unit-xs px-unit-sm py-unit-2xs rounded bg-primary text-on-primary w-fit font-label-mono text-label-mono shadow-sm">
            <span className="material-symbols-outlined text-[14px]">alternate_email</span>
            <span className="font-semibold">{data.accountEmail}</span>
          </div>
          <span className="font-caption-xs text-caption-xs text-secondary">
            Provider Account: {data.providerAccountName}
          </span>
        </div>
        <div className="pt-unit-xs">
          <span className="inline-flex items-center gap-1.5 px-unit-sm py-unit-2xs rounded bg-surface-container text-on-surface font-caption-xs text-caption-xs font-label-mono border border-outline-variant/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>User Mapped</span>
          </span>
        </div>
      </div>

      {/* 3. Network & Location */}
      <div className="p-unit-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-unit-sm border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase tracking-wider font-semibold">
            Network &amp; Location
          </span>
          <span className="material-symbols-outlined text-[18px] text-primary">public</span>
        </div>
        <div className="flex items-center justify-between bg-surface-container-low px-unit-sm py-unit-xs rounded border border-outline-variant/20">
          <div className="flex items-center gap-unit-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-label-mono text-label-mono text-on-surface font-semibold">
              {data.ipAddress}
            </span>
          </div>
          <button
            onClick={handleCopyIp}
            className="text-secondary hover:text-primary transition-colors p-0.5 rounded"
            title="Copy IP Address"
            type="button"
          >
            <span className={`material-symbols-outlined text-[16px] ${isCopied ? 'text-emerald-600' : ''}`}>
              {isCopied ? 'check' : 'content_copy'}
            </span>
          </button>
        </div>
        <div className="flex items-center justify-between text-secondary font-caption-xs text-caption-xs">
          <span>{data.region}</span>
          <span className="font-label-mono">{data.osPlatform}</span>
        </div>
      </div>

      {/* 4. Cost & Renewal */}
      <div className="p-unit-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-unit-sm border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase tracking-wider font-semibold">
            Cost &amp; Renewal
          </span>
          <span className="material-symbols-outlined text-[18px] text-primary">receipt_long</span>
        </div>
        <div className="flex items-baseline gap-unit-xs">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold font-label-mono text-primary">
            {data.billing.monthlyCostFormatted}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary">/ month</span>
        </div>
        <div className="flex flex-col gap-unit-2xs text-secondary font-caption-xs text-caption-xs">
          <div className="flex items-center justify-between">
            <span>Next Cycle:</span>
            <span className="font-semibold text-on-surface font-label-mono">
              {data.billing.renewalDateFormatted}
            </span>
          </div>
          <div className="flex items-center justify-between text-secondary">
            <span>Annual Estimate:</span>
            <span className="font-label-mono">{data.billing.annualizedCostFormatted}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
