import React from 'react';
import { Link } from 'react-router-dom';
import { WebsiteHostingData } from '../websiteDetails.types';

interface HostingSectionProps {
  hosting: WebsiteHostingData;
}

export const HostingSection: React.FC<HostingSectionProps> = ({ hosting }) => {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm p-unit-base flex flex-col justify-between border border-outline-variant/30">
      <div className="flex flex-col">
        {/* Section Header */}
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-primary text-[18px]">storage</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Hosting &amp; Infrastructure
            </h2>
          </div>
          <span className="px-unit-xs py-0.5 rounded bg-surface-container-low text-on-surface-variant font-caption-xs text-caption-xs font-semibold border border-outline-variant/20">
            {hosting.locationTag}
          </span>
        </div>

        {/* Content Details */}
        <div className="flex flex-col gap-unit-xs mt-unit-sm">
          {/* Host Instance Card */}
          <div className="bg-surface-container-low p-unit-sm rounded-lg border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-caption-xs text-caption-xs text-secondary font-medium uppercase">
                Host Instance
              </span>
              <span className="font-label-mono text-label-mono text-primary font-medium text-[11px]">
                {hosting.provider} VPS
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="font-label-md text-label-md text-on-surface font-bold">
                {hosting.serverName}
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Account: {hosting.providerAccount}
              </span>
            </div>
            <div className="mt-1 text-secondary font-caption-xs text-caption-xs">
              Account Email: <span className="font-label-mono text-on-surface">{hosting.accountEmail}</span>
            </div>
          </div>

          {/* OS & Datacenter Grid */}
          <div className="grid grid-cols-2 gap-unit-xs">
            <div className="bg-surface-container-low p-unit-sm rounded-lg border border-outline-variant/20">
              <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
                Operating System
              </span>
              <div className="flex items-center gap-1.5 mt-1 font-body-sm text-body-sm text-on-surface font-medium">
                <span className="material-symbols-outlined text-[16px] text-tertiary">memory</span>
                <span>{hosting.os}</span>
              </div>
            </div>
            <div className="bg-surface-container-low p-unit-sm rounded-lg border border-outline-variant/20">
              <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
                DC Datacenter
              </span>
              <div className="flex items-center gap-1.5 mt-1 font-body-sm text-body-sm text-on-surface font-medium">
                <span className="material-symbols-outlined text-[16px] text-primary">location_on</span>
                <span>{hosting.datacenter}</span>
              </div>
            </div>
          </div>

          {/* Cost Allocation */}
          <div className="bg-surface-container-high/40 p-unit-sm rounded-lg flex flex-col gap-1 border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-caption-xs text-caption-xs text-on-surface-variant font-semibold uppercase">
                Estimated Cost Allocation
              </span>
              <span className="font-label-mono text-label-mono text-primary font-bold">
                {hosting.costAllocation.currency}
                {hosting.costAllocation.amountMonthly} / month
              </span>
            </div>
            <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: `${hosting.costAllocation.percentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between font-caption-xs text-caption-xs text-secondary mt-0.5">
              <span>
                User Estimated Allocation: {hosting.costAllocation.currency}
                {hosting.costAllocation.amountMonthly} / month ({hosting.costAllocation.percentage}%)
              </span>
              <span>
                Total Server Cost: {hosting.costAllocation.currency}
                {hosting.costAllocation.totalServerCost}/mo
              </span>
            </div>
          </div>

          {/* Next Renewal */}
          <div className="flex items-center justify-between bg-surface-container-low p-unit-sm rounded-lg border border-outline-variant/20">
            <div className="flex items-center gap-unit-xs">
              <span className="material-symbols-outlined text-secondary text-[16px]">
                calendar_clock
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary font-medium">
                Next Renewal:
              </span>
            </div>
            <span className="font-label-mono text-label-mono text-on-surface font-bold text-[12px]">
              {hosting.nextRenewalDate}
            </span>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="pt-unit-sm mt-unit-sm flex items-center justify-between font-caption-xs text-caption-xs text-secondary border-t border-surface-container">
        <span>Server Monitoring: {hosting.monitoringStatus}</span>
        <Link
          to={`/servers/${hosting.serverId}`}
          className="text-primary hover:underline font-medium flex items-center gap-1"
        >
          <span>View Server Record</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
};
