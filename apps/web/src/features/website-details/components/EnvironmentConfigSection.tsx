import React from 'react';
import { WebsiteEnvironmentConfigData } from '../websiteDetails.types';

interface EnvironmentConfigSectionProps {
  environmentConfig: WebsiteEnvironmentConfigData;
}

export const EnvironmentConfigSection: React.FC<EnvironmentConfigSectionProps> = ({
  environmentConfig,
}) => {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm p-unit-base flex flex-col justify-between border border-outline-variant/30">
      <div>
        {/* Section Header */}
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-primary text-[18px]">key</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Environment Configuration
            </h2>
          </div>
          <span
            className="material-symbols-outlined text-secondary text-[16px]"
            title="No secret values exposed"
          >
            shield_lock
          </span>
        </div>

        {/* Security Disclosure Callout */}
        <div className="bg-surface-container-high/30 p-unit-sm rounded-lg my-unit-sm flex items-start gap-unit-xs border border-outline-variant/20">
          <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">
            info
          </span>
          <span className="font-caption-xs text-caption-xs text-on-surface-variant leading-normal">
            {environmentConfig.disclosureNote}
          </span>
        </div>

        {/* Rows */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between p-unit-xs px-unit-sm bg-surface-container-low rounded-md border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Environment Variables
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Application runtime
              </span>
            </div>
            <span className="font-caption-xs text-caption-xs text-primary font-semibold">
              {environmentConfig.variableCountLabel}
            </span>
          </div>

          <div className="flex items-center justify-between p-unit-xs px-unit-sm bg-surface-container-low rounded-md border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Secret Storage
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Credentials management
              </span>
            </div>
            <span className="font-caption-xs text-caption-xs text-secondary font-medium">
              {environmentConfig.secretStorage}
            </span>
          </div>

          <div className="flex items-center justify-between p-unit-xs px-unit-sm bg-surface-container-low rounded-md border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Configuration File
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">Local path</span>
            </div>
            <span className="font-label-mono text-label-mono text-on-surface font-semibold text-[11px]">
              {environmentConfig.configFilePath}
            </span>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="pt-unit-sm mt-unit-sm flex items-center justify-between font-caption-xs text-caption-xs text-secondary border-t border-surface-container">
        <span>Secret values hidden in this view</span>
        <span className="font-label-mono text-[11px] text-secondary">Read-Only Summary</span>
      </div>
    </div>
  );
};
