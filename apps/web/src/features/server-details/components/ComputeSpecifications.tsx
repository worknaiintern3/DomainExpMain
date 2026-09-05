import React from 'react';
import { ServerDetailData } from '../serverDetails.types';

interface ComputeSpecificationsProps {
  data: ServerDetailData;
}

export const ComputeSpecifications: React.FC<ComputeSpecificationsProps> = ({ data }) => {
  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sm flex flex-col border border-outline-variant/30">
      {/* Card Header */}
      <div className="p-unit-md flex items-center justify-between bg-surface-container-low rounded-t-xl border-b border-outline-variant/30">
        <div className="flex items-center gap-unit-sm">
          <span className="material-symbols-outlined text-primary text-[20px]">memory</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Overview &amp; Hardware Specs
          </h2>
        </div>
      </div>

      {/* 6 Hardware / Network Specs Tiles */}
      <div className="p-unit-md grid grid-cols-1 sm:grid-cols-2 gap-unit-md">
        {data.specs.map((spec) => (
          <div
            key={spec.label}
            className="p-unit-sm rounded-lg bg-surface-container-low flex flex-col gap-unit-2xs border border-outline-variant/20"
          >
            <div className="flex items-center justify-between text-secondary font-caption-xs text-caption-xs">
              <span>{spec.label}</span>
              <span
                className={`px-unit-xs py-unit-2xs rounded font-caption-xs text-caption-xs font-medium ${
                  spec.badge === 'Stored Provider Data' || spec.badge === 'Reference Data'
                    ? 'bg-surface-container-high text-primary border border-primary/20'
                    : 'bg-surface-container-high text-secondary border border-outline-variant/20'
                }`}
              >
                {spec.badge}
              </span>
            </div>
            <span
              className={`font-headline-sm text-headline-sm text-on-surface font-semibold ${
                spec.isMono ? 'font-label-mono' : ''
              }`}
            >
              {spec.value}
            </span>
          </div>
        ))}
      </div>

      {/* Project Context & Inventory Tags Strip */}
      <div className="px-unit-md pb-unit-md flex flex-col gap-unit-sm">
        <div className="p-unit-sm rounded-lg bg-surface-container-high flex flex-wrap items-center justify-between gap-unit-sm border border-outline-variant/20">
          <div className="flex items-center gap-unit-sm">
            <span className="font-caption-xs text-caption-xs text-secondary uppercase tracking-wider font-semibold">
              Project:
            </span>
            <span className="font-label-md text-label-md font-semibold text-primary">
              {data.project}
            </span>
          </div>
          <div className="flex items-center gap-unit-xs flex-wrap">
            <span className="font-caption-xs text-caption-xs text-secondary uppercase tracking-wider mr-1 font-semibold">
              Tags:
            </span>
            {data.tags.map((tag) => (
              <span
                key={tag}
                className="px-unit-sm py-unit-2xs rounded bg-surface-container-lowest text-on-surface font-caption-xs text-caption-xs border border-outline-variant/30 font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
