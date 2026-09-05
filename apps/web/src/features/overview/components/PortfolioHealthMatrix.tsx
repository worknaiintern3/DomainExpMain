import React from 'react';
import { HealthMatrixData } from '../overview.types';

interface PortfolioHealthMatrixProps {
  data: HealthMatrixData;
}

export const PortfolioHealthMatrix: React.FC<PortfolioHealthMatrixProps> = ({ data }) => {
  return (
    <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm flex flex-col gap-unit-sm border border-outline-variant/40">
      <div className="flex items-center justify-between flex-wrap gap-unit-xs">
        <div className="flex items-center gap-unit-xs">
          <span className="font-headline-sm text-headline-sm text-[16px] text-on-surface font-semibold">
            Portfolio Health Matrix
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary font-label-mono">
            ({data.totalAssets} Domains Tracked)
          </span>
        </div>
        <div className="flex items-center gap-unit-lg text-caption-xs font-caption-xs">
          {data.segments.map((seg) => (
            <div key={seg.status} className="flex items-center gap-unit-xs">
              <span
                className={`w-2.5 h-2.5 rounded-sm ${
                  seg.status === 'healthy'
                    ? 'bg-tertiary'
                    : seg.status === 'warning'
                    ? 'bg-secondary-container'
                    : 'bg-error'
                }`}
              />
              <span className="text-on-surface font-medium">
                {seg.count} {seg.label}
              </span>
              <span className="text-secondary font-label-mono">{seg.percentage.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* High Density Segmented Horizontal Bar */}
      <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden flex gap-0.5">
        {data.segments.map((seg) => (
          <div
            key={seg.status}
            className={`h-full transition-all ${
              seg.status === 'healthy'
                ? 'bg-tertiary'
                : seg.status === 'warning'
                ? 'bg-secondary-container'
                : 'bg-error'
            }`}
            style={{ width: `${seg.percentage}%` }}
            title={`${seg.count} ${seg.label} Domains (${seg.percentage.toFixed(1)}%)`}
          />
        ))}
      </div>
    </div>
  );
};
