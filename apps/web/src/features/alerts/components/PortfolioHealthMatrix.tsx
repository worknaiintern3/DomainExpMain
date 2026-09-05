import React from 'react';
import { HealthMatrixItem } from '../alerts.types';

interface PortfolioHealthMatrixProps {
  items: HealthMatrixItem[];
  onInspect: (item: HealthMatrixItem) => void;
}

export const PortfolioHealthMatrix: React.FC<PortfolioHealthMatrixProps> = ({
  items,
  onInspect,
}) => {
  const getOverallHealthBadge = (health: 'Critical' | 'Warning' | 'Healthy') => {
    switch (health) {
      case 'Critical':
        return (
          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-caption-xs text-caption-xs font-bold">
            Critical
          </span>
        );
      case 'Warning':
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-caption-xs text-caption-xs font-bold">
            Warning
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-surface-container text-secondary font-caption-xs text-caption-xs font-bold">
            Healthy
          </span>
        );
    }
  };

  const getDaysColor = (days: number) => {
    if (days <= 7) return 'text-rose-700 font-bold';
    if (days <= 30) return 'text-amber-700 font-bold';
    return 'text-secondary font-medium';
  };

  return (
    <div className="bg-surface-container-lowest p-unit-lg rounded-xl shadow-micro flex flex-col gap-unit-md w-full border border-outline-variant/30">
      {/* Matrix Header */}
      <div className="flex flex-wrap items-center justify-between gap-unit-sm">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Domain Health Matrix
          </h2>
          <p className="font-caption-xs text-caption-xs text-secondary mt-unit-2xs">
            Health summary calculated from available portfolio and reference domain records.
          </p>
        </div>
        <span className="px-unit-xs py-0.5 rounded-full bg-secondary-container text-primary font-caption-xs text-caption-xs font-semibold">
          Based on stored domain records
        </span>
      </div>

      {/* Full-Width Table */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low h-8 text-secondary font-caption-xs text-caption-xs uppercase tracking-wider border-b border-outline-variant/30">
              <th className="px-unit-md py-unit-xs font-semibold">Domain</th>
              <th className="px-unit-md py-unit-xs font-semibold">SSL Health</th>
              <th className="px-unit-md py-unit-xs font-semibold">DNS Status</th>
              <th className="px-unit-md py-unit-xs font-semibold">Auto-Renew</th>
              <th className="px-unit-md py-unit-xs font-semibold">Days Left</th>
              <th className="px-unit-md py-unit-xs font-semibold">Overall Calculated Status</th>
              <th className="px-unit-md py-unit-xs font-semibold text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y-0 text-body-sm font-body-sm">
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => onInspect(item)}
                className="h-11 bg-surface-container-lowest hover:bg-surface-container-low transition-colors cursor-pointer border-b border-surface-container/40"
              >
                {/* Domain */}
                <td className="px-unit-md py-unit-xs font-label-mono text-label-mono font-bold text-on-surface">
                  {item.domain}
                </td>

                {/* SSL Health */}
                <td className="px-unit-md py-unit-xs whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 text-secondary font-caption-xs text-caption-xs">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.sslHealth.includes('Expiring')
                          ? 'bg-amber-500'
                          : 'bg-primary'
                      }`}
                    />
                    {item.sslHealth}
                  </span>
                </td>

                {/* DNS Status */}
                <td className="px-unit-md py-unit-xs whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 text-secondary font-caption-xs text-caption-xs">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.dnsStatus.includes('DNSSEC')
                          ? 'bg-amber-500'
                          : 'bg-primary'
                      }`}
                    />
                    {item.dnsStatus}
                  </span>
                </td>

                {/* Auto-Renew */}
                <td
                  className={`px-unit-md py-unit-xs whitespace-nowrap font-medium text-caption-xs ${
                    item.autoRenewIsRisk ? 'text-rose-700' : 'text-secondary'
                  }`}
                >
                  {item.autoRenewStatus}
                </td>

                {/* Days Left */}
                <td
                  className={`px-unit-md py-unit-xs whitespace-nowrap font-label-mono text-label-mono ${getDaysColor(
                    item.daysRemaining
                  )}`}
                >
                  {item.daysRemainingLabel}
                </td>

                {/* Overall Health */}
                <td className="px-unit-md py-unit-xs whitespace-nowrap">
                  {getOverallHealthBadge(item.overallHealth)}
                </td>

                {/* Quick Inspect Button */}
                <td
                  className="px-unit-md py-unit-xs whitespace-nowrap text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onInspect(item)}
                    className="h-7 px-unit-sm rounded bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md cursor-pointer"
                  >
                    Inspect
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Semantic Footnote */}
      <div className="p-unit-sm rounded-lg bg-surface-container-low text-secondary font-caption-xs text-caption-xs flex items-center gap-2 border border-outline-variant/20">
        <span className="material-symbols-outlined text-[16px] text-primary">info</span>
        <span>
          Calculated Portfolio Status: Expiry status is derived strictly from stored reference records (Critical ≤ 7d, Warning 8–30d, Healthy &gt; 30d). Live registrar background probes are not connected.
        </span>
      </div>
    </div>
  );
};
