import React from 'react';
import { Link } from 'react-router-dom';
import { DomainDetailData } from '../domainDetails.types';

interface HostingMappingSectionProps {
  data: DomainDetailData;
}

export const HostingMappingSection: React.FC<HostingMappingSectionProps> = ({ data }) => {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-unit-lg shadow-sm border border-outline-variant/30">
      {/* Header */}
      <div className="flex items-center justify-between pb-unit-sm mb-unit-md bg-surface-container-low/40 p-unit-sm rounded-lg border border-outline-variant/20">
        <div className="flex items-center gap-unit-xs">
          <span className="material-symbols-outlined text-primary text-[20px]">cloud_circle</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Hosting &amp; Server
          </h2>
        </div>
        <span className="px-unit-xs py-unit-2xs rounded bg-surface-container text-primary font-caption-xs text-caption-xs font-semibold border border-outline-variant/20">
          Mapped Asset
        </span>
      </div>

      <div className="space-y-unit-sm">
        {/* Target Application Link */}
        <div className="bg-surface-container-low p-unit-sm rounded-lg border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold block mb-unit-2xs">
            Target Application
          </span>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-unit-xs">
              <span className="material-symbols-outlined text-primary text-[18px]">web</span>
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                {data.targetAppName}
              </span>
            </div>
            <a
              className="text-primary hover:text-tertiary transition-colors"
              href={data.targetAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Target URL"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            </a>
          </div>
          <span className="font-caption-xs text-caption-xs text-on-surface-variant font-label-mono block mt-1">
            {data.targetAppUrl}
          </span>
        </div>

        {/* Mapped VPS Card */}
        <div className="bg-surface-container-low p-unit-sm rounded-lg border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold block mb-unit-2xs">
            Mapped Server
          </span>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-unit-2xs">
            <Link
              to="/servers"
              className="font-label-md text-label-md font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">storage</span>
              <span>{data.mappedServerName}</span>
            </Link>
            <span className="font-caption-xs text-caption-xs px-unit-xs py-0.5 rounded bg-surface-container text-secondary font-medium border border-outline-variant/20">
              Server Inventory Record • Monitoring Not Connected
            </span>
          </div>
          <div className="flex flex-col gap-1 font-caption-xs text-caption-xs text-on-surface-variant mt-2 border-t border-surface-container pt-2">
            <div className="flex justify-between">
              <span>Provider:</span>
              <span className="font-medium text-on-surface">{data.mappedServerProvider}</span>
            </div>
            <div className="flex justify-between">
              <span>Public IPv4:</span>
              <span className="font-label-mono text-label-mono text-on-surface font-semibold">
                {data.mappedServerIp}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Region:</span>
              <span className="font-medium text-on-surface">{data.mappedServerRegion}</span>
            </div>
          </div>
        </div>

        {/* Server Admin Infrastructure Account */}
        <div className="bg-surface-container-low p-unit-sm rounded-lg border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold block mb-unit-2xs">
            Infrastructure Account
          </span>
          <div className="flex items-center gap-unit-xs">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[14px]">terminal</span>
            </div>
            <span className="font-label-mono text-label-mono text-on-surface text-[12px] font-semibold truncate" title={data.infraAccountEmail}>
              {data.infraAccountEmail}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-secondary">{data.infraAccountOrg}</div>
        </div>
      </div>
    </div>
  );
};
