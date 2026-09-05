import React from 'react';
import { WebsiteDetailData } from '../websiteDetails.types';

interface WebsiteRibbonStripProps {
  data: WebsiteDetailData;
}

export const WebsiteRibbonStrip: React.FC<WebsiteRibbonStripProps> = ({ data }) => {
  return (
    <div className="mt-unit-md grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-unit-2xs bg-surface-container-low p-unit-xs rounded-xl shadow-sm border border-outline-variant/30">
      {/* 1. Primary Domain */}
      <div className="bg-surface-container-lowest p-unit-sm rounded-lg flex flex-col justify-between border border-outline-variant/20">
        <span className="font-caption-xs text-caption-xs text-secondary font-semibold uppercase tracking-wider">
          Primary Domain
        </span>
        <div className="mt-unit-2xs">
          <span className="font-label-mono text-label-mono text-on-surface font-semibold truncate block">
            {data.primaryDomain}
          </span>
          <span className="font-caption-xs text-caption-xs text-primary font-medium">
            {data.domainRole}
          </span>
        </div>
      </div>

      {/* 2. Alt Hostnames */}
      <div className="bg-surface-container-lowest p-unit-sm rounded-lg flex flex-col justify-between border border-outline-variant/20">
        <span className="font-caption-xs text-caption-xs text-secondary font-semibold uppercase tracking-wider">
          Alt Hostnames
        </span>
        <div className="mt-unit-2xs">
          <span className="font-label-mono text-label-mono text-on-surface truncate block">
            {data.altHostnames.join(', ') || 'None'}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary">
            {data.altHostnamesRole}
          </span>
        </div>
      </div>

      {/* 3. Environment */}
      <div className="bg-surface-container-lowest p-unit-sm rounded-lg flex flex-col justify-between border border-outline-variant/20">
        <span className="font-caption-xs text-caption-xs text-secondary font-semibold uppercase tracking-wider">
          Environment
        </span>
        <div className="mt-unit-2xs flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              data.environment === 'Production'
                ? 'bg-primary'
                : data.environment === 'Staging'
                ? 'bg-amber-500'
                : 'bg-secondary'
            }`}
          />
          <span className="font-label-md text-label-md text-on-surface font-medium">
            {data.environment}
          </span>
        </div>
      </div>

      {/* 4. Target VPS Node */}
      <div className="bg-surface-container-lowest p-unit-sm rounded-lg flex flex-col justify-between border border-outline-variant/20">
        <span className="font-caption-xs text-caption-xs text-secondary font-semibold uppercase tracking-wider">
          Target VPS Node
        </span>
        <div className="mt-unit-2xs">
          <span className="font-label-md text-label-md text-on-surface font-semibold truncate block">
            {data.hosting.serverName}
          </span>
          <span className="font-caption-xs text-caption-xs font-label-mono text-secondary">
            {data.hosting.ipAddress} (SG)
          </span>
        </div>
      </div>

      {/* 5. Server Provider */}
      <div className="bg-surface-container-lowest p-unit-sm rounded-lg flex flex-col justify-between border border-outline-variant/20">
        <span className="font-caption-xs text-caption-xs text-secondary font-semibold uppercase tracking-wider">
          Server Provider
        </span>
        <div className="mt-unit-2xs">
          <span className="font-label-md text-label-md text-on-surface font-semibold block">
            {data.hosting.provider}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary truncate block">
            {data.hosting.providerAccount}
          </span>
        </div>
      </div>

      {/* 6. Hosting Account Email */}
      <div className="bg-surface-container-lowest p-unit-sm rounded-lg flex flex-col justify-between border border-outline-variant/20">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs text-secondary font-semibold uppercase tracking-wider">
            Hosting Account Email
          </span>
        </div>
        <div className="mt-unit-2xs">
          <span className="font-label-mono text-label-mono text-on-surface truncate block text-[11px]">
            {data.hosting.accountEmail}
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="font-caption-xs text-caption-xs text-secondary truncate">
              {data.hosting.providerAccount}
            </span>
            <span className="px-1 rounded bg-surface-container text-secondary text-[9px] font-medium">
              User Mapped
            </span>
          </div>
        </div>
      </div>

      {/* 7. Tech Stack & Port */}
      <div className="bg-surface-container-lowest p-unit-sm rounded-lg flex flex-col justify-between border border-outline-variant/20">
        <span className="font-caption-xs text-caption-xs text-secondary font-semibold uppercase tracking-wider">
          Tech Stack &amp; Port
        </span>
        <div className="mt-unit-2xs">
          <span className="font-label-md text-label-md text-on-surface font-semibold block">
            {data.techStack}
          </span>
          <span className="font-label-mono text-label-mono text-primary font-medium text-[11px]">
            Port :{data.port}
          </span>
        </div>
      </div>

      {/* 8. Source Repo */}
      <div className="bg-surface-container-lowest p-unit-sm rounded-lg flex flex-col justify-between border border-outline-variant/20">
        <span className="font-caption-xs text-caption-xs text-secondary font-semibold uppercase tracking-wider">
          Source Repo
        </span>
        <div className="mt-unit-2xs">
          <a
            href={data.sourceRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label-mono text-label-mono text-primary hover:underline truncate block text-[11px]"
          >
            {data.sourceRepoName}
          </a>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="font-caption-xs text-caption-xs text-secondary">Repository</span>
            <span className="px-1 rounded bg-surface-container text-secondary text-[9px] font-medium">
              User Added
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
