import React from 'react';
import { GraphSummaryMetrics } from '../infrastructureMap.types';

interface InfrastructureMapMetricsProps {
  metrics: GraphSummaryMetrics;
  onSelectBottleneck?: () => void;
}

export const InfrastructureMapMetrics: React.FC<InfrastructureMapMetricsProps> = ({
  metrics,
  onSelectBottleneck,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-unit-md">
      {/* 1. Visible Graph Nodes */}
      <div className="p-unit-md rounded-xl bg-surface-container-lowest shadow-micro border border-outline-variant/30 flex flex-col gap-unit-xs">
        <span className="font-caption-xs text-caption-xs uppercase text-secondary font-semibold tracking-wider">
          Visible Graph Nodes
        </span>
        <div className="flex items-baseline justify-between mt-1">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold">
            {metrics.totalAssetsCount} Nodes
          </span>
          <span className="font-label-md text-label-md text-primary font-medium">
            {metrics.weeklyGrowthLabel}
          </span>
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary mt-1">
          Stored inventory relationship records
        </span>
      </div>

      {/* 2. Highest Mapping Density */}
      <div
        onClick={onSelectBottleneck}
        className="p-unit-md rounded-xl bg-surface-container-lowest shadow-micro border border-outline-variant/30 flex flex-col gap-unit-xs cursor-pointer hover:shadow-md transition-shadow group"
      >
        <span className="font-caption-xs text-caption-xs uppercase text-secondary font-semibold tracking-wider">
          Highest Mapping Density
        </span>
        <div className="flex items-baseline justify-between mt-1">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold truncate group-hover:text-primary transition-colors">
            {metrics.bottleneckNodeName}
          </span>
          <span className="font-label-md text-label-md text-amber-700 font-medium shrink-0">
            {metrics.bottleneckWebsitesCount} Websites
          </span>
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary mt-1">
          Highest number of stored website relationships in this reference graph
        </span>
      </div>

      {/* 3. Unmapped Nodes */}
      <div className="p-unit-md rounded-xl bg-surface-container-lowest shadow-micro border border-outline-variant/30 flex flex-col gap-unit-xs">
        <span className="font-caption-xs text-caption-xs uppercase text-secondary font-semibold tracking-wider">
          Unmapped Nodes
        </span>
        <div className="flex items-baseline justify-between mt-1">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold">
            {metrics.orphanedAssetsCount} Nodes
          </span>
          <span className="font-label-md text-label-md text-emerald-700 font-medium">
            {metrics.orphanedPercentageLabel}
          </span>
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary mt-1">
          All visible reference nodes have stored relationship mappings.
        </span>
      </div>
    </div>
  );
};
