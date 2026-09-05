import React from 'react';
import { WebsiteSummaryMetrics } from '../websites.types';

interface WebsiteSummaryStripProps {
  summary: WebsiteSummaryMetrics;
}

export const WebsiteSummaryStrip: React.FC<WebsiteSummaryStripProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-unit-sm mb-unit-lg">
      {/* 1. Total Assets */}
      <div className="flex flex-col p-unit-md bg-surface-container-lowest rounded-xl shadow-sm hover:shadow transition-shadow border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs text-secondary font-mono uppercase tracking-wider">
            Total Assets
          </span>
          <span className="material-symbols-outlined text-secondary text-[16px]">language</span>
        </div>
        <div className="mt-unit-xs flex items-baseline gap-unit-xs">
          <span className="font-headline-md text-headline-md text-on-surface font-bold font-label-mono">
            {summary.totalAssets}
          </span>
        </div>
        <div className="mt-unit-xs flex items-center gap-unit-2xs">
          <span className="font-caption-xs text-caption-xs text-secondary font-medium">
            Websites, APIs &amp; Apps
          </span>
        </div>
      </div>

      {/* 2. Production */}
      <div className="flex flex-col p-unit-md bg-surface-container-lowest rounded-xl shadow-sm hover:shadow transition-shadow border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs text-secondary font-mono uppercase tracking-wider">
            Production
          </span>
          <span className="material-symbols-outlined text-primary text-[16px]">rocket_launch</span>
        </div>
        <div className="mt-unit-xs flex items-baseline gap-unit-xs">
          <span className="font-headline-md text-headline-md text-on-surface font-bold font-label-mono">
            {summary.productionCount}
          </span>
        </div>
        <div className="mt-unit-xs flex items-center gap-unit-2xs">
          <span className="font-caption-xs text-caption-xs text-secondary font-medium">
            Production assets
          </span>
        </div>
      </div>

      {/* 3. Staging / Dev */}
      <div className="flex flex-col p-unit-md bg-surface-container-lowest rounded-xl shadow-sm hover:shadow transition-shadow border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs text-secondary font-mono uppercase tracking-wider">
            Staging / Dev
          </span>
          <span className="material-symbols-outlined text-tertiary-container text-[16px]">terminal</span>
        </div>
        <div className="mt-unit-xs flex items-baseline gap-unit-xs">
          <span className="font-headline-md text-headline-md text-on-surface font-bold font-label-mono">
            {summary.stagingDevCount}
          </span>
        </div>
        <div className="mt-unit-xs flex items-center gap-unit-2xs">
          <span className="font-caption-xs text-caption-xs text-secondary font-medium">
            Non-production assets
          </span>
        </div>
      </div>

      {/* 4. Needs Attention */}
      <div className="flex flex-col p-unit-md bg-surface-container-lowest rounded-xl shadow-sm hover:shadow transition-shadow border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs text-error font-mono uppercase tracking-wider font-semibold">
            Needs Attention
          </span>
          <span className="material-symbols-outlined text-error text-[16px]">warning</span>
        </div>
        <div className="mt-unit-xs flex items-baseline gap-unit-xs">
          <span className="font-headline-md text-headline-md text-error font-bold font-label-mono">
            {summary.attentionCount}
          </span>
        </div>
        <div className="mt-unit-xs flex items-center gap-unit-2xs">
          <span className="font-caption-xs text-caption-xs text-error font-medium">
            1 SSL + 1 Expiry
          </span>
        </div>
      </div>

      {/* 5. Servers Used */}
      <div className="flex flex-col p-unit-md bg-surface-container-lowest rounded-xl shadow-sm hover:shadow transition-shadow border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs text-secondary font-mono uppercase tracking-wider">
            Servers Used
          </span>
          <span className="material-symbols-outlined text-secondary text-[16px]">dns</span>
        </div>
        <div className="mt-unit-xs flex items-baseline gap-unit-xs">
          <span className="font-headline-md text-headline-md text-on-surface font-bold font-label-mono">
            {summary.serversUsedCount}
          </span>
        </div>
        <div className="mt-unit-xs flex items-center gap-unit-2xs">
          <span className="font-caption-xs text-caption-xs text-secondary font-medium">
            Across {summary.serversUsedCount} mapped servers
          </span>
        </div>
      </div>

      {/* 6. Connected Domains */}
      <div className="flex flex-col p-unit-md bg-surface-container-lowest rounded-xl shadow-sm hover:shadow transition-shadow border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs text-secondary font-mono uppercase tracking-wider">
            Connected Domains
          </span>
          <span className="material-symbols-outlined text-secondary text-[16px]">link</span>
        </div>
        <div className="mt-unit-xs flex items-baseline gap-unit-xs">
          <span className="font-headline-md text-headline-md text-on-surface font-bold font-label-mono">
            {summary.connectedDomainsCount}
          </span>
        </div>
        <div className="mt-unit-xs flex items-center gap-unit-2xs">
          <span className="font-caption-xs text-caption-xs text-secondary font-medium">
            Mapped domains / hosts
          </span>
        </div>
      </div>
    </div>
  );
};
