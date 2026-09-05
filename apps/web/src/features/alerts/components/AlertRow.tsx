import React from 'react';
import { AlertItem, AlertSeverity } from '../alerts.types';

interface AlertRowProps {
  alert: AlertItem;
  isSelected: boolean;
  onSelect: (alert: AlertItem) => void;
  onSetReminder: (alert: AlertItem, e: React.MouseEvent) => void;
  onMarkResolved?: (alert: AlertItem, e: React.MouseEvent) => void;
}

export const AlertRow: React.FC<AlertRowProps> = ({
  alert,
  isSelected,
  onSelect,
  onSetReminder,
}) => {
  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-caption-xs text-caption-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            CRITICAL
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-caption-xs text-caption-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            WARNING
          </span>
        );
      case 'UPCOMING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary-container text-primary font-caption-xs text-caption-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            UPCOMING
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container text-secondary font-caption-xs text-caption-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            RESOLVED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container text-primary font-caption-xs text-caption-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            INFO
          </span>
        );
    }
  };

  const getDueDateColor = (severity: AlertSeverity) => {
    if (severity === 'CRITICAL') return 'text-rose-700 font-semibold';
    if (severity === 'WARNING') return 'text-amber-700 font-semibold';
    if (severity === 'RESOLVED') return 'text-secondary';
    return 'text-on-surface';
  };

  const getPrimaryActionLabel = () => {
    if (alert.severity === 'RESOLVED') return 'View History';
    if (alert.type === 'SSL Certificate') return 'Inspect SSL';
    if (alert.type === 'DNSSEC Alert') return 'Inspect DNS';
    if (alert.severity === 'UPCOMING') return 'View Domain';
    return 'Review';
  };

  return (
    <tr
      onClick={() => onSelect(alert)}
      className={`h-11 transition-colors cursor-pointer group border-b border-surface-container/40 ${
        isSelected
          ? 'bg-primary-container/10 hover:bg-primary-container/15'
          : 'bg-surface-container-lowest hover:bg-surface-container-low'
      }`}
    >
      {/* Severity */}
      <td className="px-unit-md py-unit-xs whitespace-nowrap">
        {getSeverityBadge(alert.severity)}
      </td>

      {/* Type */}
      <td className="px-unit-md py-unit-xs whitespace-nowrap text-secondary font-medium text-body-sm">
        {alert.type}
      </td>

      {/* Entity / Domain */}
      <td className="px-unit-md py-unit-xs whitespace-nowrap font-label-mono text-label-mono font-semibold text-on-surface">
        {alert.domain}
      </td>

      {/* Risk Insight */}
      <td className="px-unit-md py-unit-xs text-on-surface max-w-xs truncate text-body-sm">
        {alert.riskInsight}
      </td>

      {/* Triggered Date */}
      <td className="px-unit-md py-unit-xs whitespace-nowrap text-secondary font-label-mono text-label-mono">
        {alert.triggeredDate}
      </td>

      {/* Due Date */}
      <td
        className={`px-unit-md py-unit-xs whitespace-nowrap font-label-mono text-label-mono ${getDueDateColor(
          alert.severity
        )}`}
      >
        {alert.dueDate}
      </td>

      {/* Status */}
      <td className="px-unit-md py-unit-xs whitespace-nowrap">
        {alert.status === 'unread' ? (
          <span className="px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-caption-xs text-caption-xs font-semibold">
            Unread
          </span>
        ) : alert.status === 'resolved' ? (
          <span className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-caption-xs text-caption-xs">
            Resolved
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-caption-xs text-caption-xs">
            Read
          </span>
        )}
      </td>

      {/* Quick Actions */}
      <td
        className="px-unit-md py-unit-xs whitespace-nowrap text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inline-flex items-center gap-unit-2xs">
          <button
            type="button"
            onClick={() => onSelect(alert)}
            className={`h-7 px-unit-sm rounded font-label-md text-label-md transition-colors cursor-pointer ${
              alert.severity === 'CRITICAL'
                ? 'bg-primary text-on-primary hover:bg-tertiary shadow-xs'
                : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
            }`}
          >
            {getPrimaryActionLabel()}
          </button>

          {alert.severity !== 'RESOLVED' && (
            <button
              type="button"
              onClick={(e) => onSetReminder(alert, e)}
              title={`Set Reminder for ${alert.domain}`}
              className="h-7 w-7 flex items-center justify-center rounded bg-surface-container text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">alarm</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
