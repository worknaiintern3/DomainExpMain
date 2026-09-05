import React from 'react';
import { RenewalForecastData } from '../overview.types';

interface RenewalForecastChartProps {
  data: RenewalForecastData;
}

export const RenewalForecastChart: React.FC<RenewalForecastChartProps> = ({ data }) => {
  return (
    <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/40">
      <div className="flex items-start justify-between">
        <div>
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
            Renewal Forecast (H2-H1)
          </span>
          <div className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            {data.totalFormatted}
          </div>
          <span className="font-caption-xs text-caption-xs text-secondary">6-Month Cash Commitment</span>
        </div>
        <div className="flex items-center gap-1 text-tertiary bg-secondary-container/40 px-1.5 py-0.5 rounded font-label-mono text-[11px] font-semibold">
          <span>{data.averageFormatted}</span>
        </div>
      </div>

      {/* High-efficiency Custom SVG Bar Chart */}
      <div className="mt-unit-md">
        <svg
          className="w-full h-28"
          fill="none"
          viewBox="0 0 320 110"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="6-Month Renewal Forecast Chart"
        >
          {/* Horizontal Gridlines */}
          <line
            className="text-surface-container"
            stroke="currentColor"
            strokeDasharray="2 2"
            x1="0"
            x2="320"
            y1="20"
            y2="20"
          />
          <line
            className="text-surface-container"
            stroke="currentColor"
            strokeDasharray="2 2"
            x1="0"
            x2="320"
            y1="50"
            y2="50"
          />
          <line
            className="text-surface-container"
            stroke="currentColor"
            strokeDasharray="2 2"
            x1="0"
            x2="320"
            y1="80"
            y2="80"
          />

          {/* Render Months */}
          {data.months.map((m, index) => {
            const xPos = 20 + index * 52;
            const textX = xPos + 14;
            const textY = m.yPosition - 5;
            return (
              <g key={m.month} className="group cursor-pointer">
                <rect
                  className={`${m.colorClass} transition-colors`}
                  height={m.barHeight}
                  rx="3"
                  width="28"
                  x={xPos}
                  y={m.yPosition}
                />
                <text
                  className={`fill-on-surface font-label-mono text-[9px] ${
                    m.isPeak ? 'font-bold' : 'font-medium'
                  }`}
                  textAnchor="middle"
                  x={textX}
                  y={textY}
                >
                  {m.formattedAmount}
                </text>
                <text
                  className="fill-secondary font-label-mono text-[10px]"
                  textAnchor="middle"
                  x={textX}
                  y="98"
                >
                  {m.month}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="pt-unit-xs flex items-center justify-between border-t border-surface-container font-caption-xs text-caption-xs text-secondary mt-unit-xs">
        <span>
          Peak month: <strong className="text-on-surface font-semibold">{data.peakMonthText.replace('Peak month: ', '')}</strong>
        </span>
        <span className="text-tertiary font-medium">{data.autoRenewCountText}</span>
      </div>
    </div>
  );
};
