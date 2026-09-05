import React from 'react';
import { ServerSummaryMetrics } from '../servers.types';

interface ServerSummaryStripProps {
  summary: ServerSummaryMetrics;
}

export const ServerSummaryStrip: React.FC<ServerSummaryStripProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-unit-md mb-unit-lg">
      {/* 1. Total Servers */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary">
            Total Servers
          </span>
          <span className="material-symbols-outlined text-[18px] text-primary">dns</span>
        </div>
        <div className="mt-unit-sm">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight font-label-mono">
            {summary.totalServers}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary block mt-unit-2xs">
            Multi-provider fleet
          </span>
        </div>
      </div>

      {/* 2. Active Servers */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary">
            Active Inventory
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
        </div>
        <div className="mt-unit-sm">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight font-label-mono">
            {summary.activeCount}
          </span>
          <span className="font-caption-xs text-caption-xs text-emerald-600 block mt-unit-2xs font-medium">
            {summary.activeCount} of {summary.totalServers} active records
          </span>
        </div>
      </div>

      {/* 3. Needs Attention */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary">
            Needs Attention
          </span>
          <span className="w-2 h-2 rounded-full bg-amber-500 ring-4 ring-amber-100" />
        </div>
        <div className="mt-unit-sm">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight font-label-mono">
            {summary.attentionCount}
          </span>
          <span className="font-caption-xs text-caption-xs text-amber-600 block mt-unit-2xs font-medium">
            Renewal in 7 days
          </span>
        </div>
      </div>

      {/* 4. Hosted Websites */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary">
            Hosted Websites
          </span>
          <span className="material-symbols-outlined text-[18px] text-secondary">language</span>
        </div>
        <div className="mt-unit-sm">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight font-label-mono">
            {summary.hostedWebsitesCount}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary block mt-unit-2xs">
            Across {summary.totalServers} nodes
          </span>
        </div>
      </div>

      {/* 5. Monthly Cost */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary">
            Estimated Monthly Cost
          </span>
          <span className="material-symbols-outlined text-[18px] text-secondary">payments</span>
        </div>
        <div className="mt-unit-sm">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight font-label-mono text-primary">
            {summary.totalMonthlyCostFormatted}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary block mt-unit-2xs">
            Stored inventory run-rate
          </span>
        </div>
      </div>

      {/* 6. Upcoming Renewals */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary">
            Upcoming Renewals
          </span>
          <span className="material-symbols-outlined text-[18px] text-amber-500">event_upcoming</span>
        </div>
        <div className="mt-unit-sm">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight font-label-mono">
            {summary.upcomingRenewalsCount}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary block mt-unit-2xs">
            {summary.upcomingRenewalsSubtext}
          </span>
        </div>
      </div>
    </div>
  );
};
