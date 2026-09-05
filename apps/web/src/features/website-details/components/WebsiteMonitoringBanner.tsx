import React from 'react';

export const WebsiteMonitoringBanner: React.FC = () => {
  return (
    <div className="mt-unit-md p-unit-sm rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-unit-sm">
      <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">
        info
      </span>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-unit-xs">
          <span className="font-label-md text-label-md text-on-surface font-semibold">
            Website Monitoring: Not Connected
          </span>
          <span className="px-1.5 py-0.2 rounded bg-surface-container text-secondary font-caption-xs text-[10px]">
            Informational Disclosure
          </span>
        </div>
        <p className="font-caption-xs text-caption-xs text-on-surface-variant leading-relaxed">
          DomainPulse currently displays stored website/application inventory, infrastructure mappings, DNS information and available SSL certificate data. Live uptime, response-time and application health monitoring requires a connected monitoring integration.
        </p>
      </div>
    </div>
  );
};
