import React from 'react';
import { MonitoringCoverageItem } from '../alerts.types';

interface MonitoringCoverageSectionProps {
  coverageItems: MonitoringCoverageItem[];
  onConfigureIntegration?: (item: MonitoringCoverageItem) => void;
}

export const MonitoringCoverageSection: React.FC<MonitoringCoverageSectionProps> = ({
  coverageItems,
  onConfigureIntegration,
}) => {
  const getBadgeClass = (variant: 'neutral' | 'warning' | 'primary' | 'error') => {
    switch (variant) {
      case 'warning':
        return 'bg-amber-100 text-amber-800';
      case 'error':
        return 'bg-rose-100 text-rose-800';
      case 'primary':
        return 'bg-secondary-container text-primary';
      default:
        return 'bg-surface-container text-secondary';
    }
  };

  return (
    <div className="bg-surface-container-lowest p-unit-lg rounded-xl shadow-micro flex flex-col gap-unit-md w-full border border-outline-variant/30">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-unit-sm">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Infrastructure Monitoring Coverage
          </h2>
          <p className="font-caption-xs text-caption-xs text-secondary mt-unit-2xs">
            Explicit inventory record status versus active probe &amp; telemetry monitoring coverage.
          </p>
        </div>
        <span className="px-unit-xs py-0.5 rounded-full bg-surface-container-high text-primary font-caption-xs text-caption-xs font-semibold uppercase tracking-wider">
          Coverage Matrix
        </span>
      </div>

      {/* Coverage Table */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low h-8 text-secondary font-caption-xs text-caption-xs uppercase tracking-wider border-b border-outline-variant/30">
              <th className="px-unit-md py-unit-xs font-semibold">Asset Category</th>
              <th className="px-unit-md py-unit-xs font-semibold">Inventory Records</th>
              <th className="px-unit-md py-unit-xs font-semibold">Inventory Status</th>
              <th className="px-unit-md py-unit-xs font-semibold">Active Probe &amp; Telemetry State</th>
              <th className="px-unit-md py-unit-xs font-semibold">Monitoring Semantics &amp; Scope</th>
              <th className="px-unit-md py-unit-xs font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y-0 text-body-sm font-body-sm">
            {coverageItems.map((item) => (
              <tr
                key={item.id}
                className="h-12 bg-surface-container-lowest hover:bg-surface-container-low transition-colors border-b border-surface-container/40"
              >
                {/* Asset Category */}
                <td className="px-unit-md py-unit-xs font-medium text-on-surface whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      {item.icon}
                    </span>
                    <span className="font-semibold">{item.assetType}</span>
                  </div>
                </td>

                {/* Inventory Records */}
                <td className="px-unit-md py-unit-xs whitespace-nowrap font-label-mono text-label-mono text-on-surface font-bold">
                  {item.inventoryCount}{' '}
                  <span className="text-secondary font-normal text-caption-xs">assets</span>
                </td>

                {/* Inventory Status */}
                <td className="px-unit-md py-unit-xs whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-caption-xs text-caption-xs font-medium">
                    {item.inventoryStatus}
                  </span>
                </td>

                {/* Live Monitoring State */}
                <td className="px-unit-md py-unit-xs whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-caption-xs text-caption-xs font-bold ${getBadgeClass(
                      item.badgeVariant
                    )}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.monitoringStatus === 'Not Connected'
                          ? 'bg-rose-500'
                          : item.monitoringStatus === 'Calculated From Dates'
                          ? 'bg-amber-500'
                          : 'bg-primary'
                      }`}
                    />
                    {item.monitoringStatusLabel}
                  </span>
                </td>

                {/* Details */}
                <td className="px-unit-md py-unit-xs text-secondary text-caption-xs">
                  {item.details}
                </td>

                {/* Action */}
                <td className="px-unit-md py-unit-xs whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => onConfigureIntegration && onConfigureIntegration(item)}
                    className="h-7 px-unit-sm rounded bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md cursor-pointer"
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Explicit Disclaimer */}
      <div className="p-unit-md rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col gap-unit-xs">
        <div className="flex items-center gap-2 text-rose-700 font-caption-xs font-bold uppercase tracking-wider">
          <span className="material-symbols-outlined text-[16px]">warning</span>
          MONITORING CONNECTIVITY NOTICE
        </div>
        <p className="font-body-sm text-body-sm text-secondary">
          Live server telemetry (CPU load, RAM consumption, disk space, and daemon status) and live website response-time probes are explicitly <strong>Not Connected</strong> in this release. All displayed health indicators are calculated from stored expiration dates, recorded ports, and user-mapped relations.
        </p>
      </div>
    </div>
  );
};
