import React from 'react';
import { WebsiteDeploymentData } from '../websiteDetails.types';

interface DeploymentNotesSectionProps {
  deployment: WebsiteDeploymentData;
}

export const DeploymentNotesSection: React.FC<DeploymentNotesSectionProps> = ({
  deployment,
}) => {
  return (
    <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl shadow-sm p-unit-base flex flex-col justify-between border border-outline-variant/30">
      <div>
        {/* Section Header */}
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-primary text-[18px]">terminal</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Deployment Specs &amp; Operational Notes
            </h2>
          </div>
        </div>

        {/* Main Note Box */}
        <div className="p-unit-sm rounded-lg bg-surface-container-low flex items-start gap-unit-sm mt-unit-sm border border-outline-variant/20">
          <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
            note
          </span>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-unit-xs flex-wrap">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Deployment Method:
              </span>
              <span className="font-body-md text-body-md text-on-surface font-medium">
                {deployment.method}
              </span>
              <span className="px-1.5 py-0.2 rounded bg-surface-container text-secondary font-label-mono text-[10px] uppercase font-medium border border-outline-variant/20">
                {deployment.methodProvenance}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mt-0.5">
              {deployment.notes}
            </p>
          </div>
        </div>

        {/* 3 Sub-Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-unit-sm mt-unit-sm">
          {/* Card 1: Upstream */}
          <div className="p-unit-sm rounded-lg bg-surface-container-low flex flex-col border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
                Upstream Target
              </span>
              <span className="px-1 rounded bg-surface-container text-secondary text-[9px]">
                User Added
              </span>
            </div>
            <span className="font-label-mono text-label-mono text-on-surface font-bold text-[13px] mt-1">
              {deployment.internalTarget}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
              Internal upstream target
            </span>
          </div>

          {/* Card 2: Reverse Proxy */}
          <div className="p-unit-sm rounded-lg bg-surface-container-low flex flex-col border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
                Reverse Proxy Path
              </span>
              <span className="px-1 rounded bg-surface-container text-secondary text-[9px]">
                User Added
              </span>
            </div>
            <span className="font-label-mono text-label-mono text-on-surface font-bold text-[12px] mt-1 truncate">
              {deployment.reverseProxyConfigPath}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
              Reverse proxy config
            </span>
          </div>

          {/* Card 3: Process Runner */}
          <div className="p-unit-sm rounded-lg bg-surface-container-low flex flex-col border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
                Process Orchestration
              </span>
              <span className="px-1 rounded bg-surface-container text-secondary text-[9px]">
                User Added
              </span>
            </div>
            <span className="font-label-mono text-label-mono text-primary font-bold text-[13px] mt-1">
              {deployment.processRunner}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
              Process runner
            </span>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="pt-unit-md mt-unit-sm flex items-center justify-between text-secondary font-caption-xs text-caption-xs border-t border-surface-container">
        <span>Last updated: {deployment.lastUpdated}</span>
        <span>Documented configuration notes</span>
      </div>
    </div>
  );
};
