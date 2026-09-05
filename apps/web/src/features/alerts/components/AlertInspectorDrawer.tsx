import React from 'react';
import { AlertItem } from '../alerts.types';

interface AlertInspectorDrawerProps {
  alert: AlertItem | null;
  onSetReminder: (alert: AlertItem) => void;
  onMarkResolved: (alert: AlertItem) => void;
  onNavigateToEntity: (route: string) => void;
}

export const AlertInspectorDrawer: React.FC<AlertInspectorDrawerProps> = ({
  alert,
  onSetReminder,
  onMarkResolved,
  onNavigateToEntity,
}) => {
  if (!alert) {
    return (
      <div className="bg-surface-container-lowest p-unit-lg rounded-xl shadow-micro flex flex-col items-center justify-center text-center gap-unit-sm border border-outline-variant/30 min-h-[300px]">
        <span className="material-symbols-outlined text-[32px] text-secondary">
          touch_app
        </span>
        <p className="font-label-md text-on-surface font-semibold">Select an alert to inspect</p>
        <p className="font-caption-xs text-secondary max-w-xs">
          Click on any row in the alerts feed to view stored advisory details, metadata, and suggested actions.
        </p>
      </div>
    );
  }

  const getBadgeStyle = () => {
    switch (alert.severity) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 font-bold';
      case 'WARNING':
        return 'bg-amber-100 text-amber-800 font-bold';
      case 'UPCOMING':
        return 'bg-secondary-container text-primary font-bold';
      case 'RESOLVED':
        return 'bg-surface-container text-secondary font-bold';
      default:
        return 'bg-surface-container text-primary font-bold';
    }
  };

  const getSeverityIcon = () => {
    switch (alert.severity) {
      case 'CRITICAL':
        return { icon: 'notification_important', color: 'text-rose-700' };
      case 'WARNING':
        return { icon: 'warning', color: 'text-amber-600' };
      case 'UPCOMING':
        return { icon: 'schedule', color: 'text-primary' };
      case 'RESOLVED':
        return { icon: 'check_circle', color: 'text-secondary' };
      default:
        return { icon: 'info', color: 'text-primary' };
    }
  };

  const iconInfo = getSeverityIcon();

  return (
    <div className="bg-surface-container-lowest p-unit-lg rounded-xl shadow-micro flex flex-col gap-unit-md border border-outline-variant/30 sticky top-[calc(var(--header-height)+1.5rem)]">
      {/* Drawer Header */}
      <div className="flex items-center justify-between pb-unit-xs border-b border-surface-container/50">
        <div className="flex items-center gap-unit-xs">
          <span className={`material-symbols-outlined ${iconInfo.color} text-[20px]`}>
            {iconInfo.icon}
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            {alert.title}
          </h3>
        </div>
        <span
          className={`px-unit-xs py-0.5 rounded font-caption-xs text-caption-xs ${getBadgeStyle()}`}
        >
          {alert.severity}
        </span>
      </div>

      {/* Target Domain / Entity Banner */}
      <div className="p-unit-sm rounded-lg bg-surface-container-low flex items-center justify-between border border-outline-variant/20">
        <div className="flex items-center gap-unit-xs">
          <span className="material-symbols-outlined text-primary text-[18px]">
            {alert.entityType === 'server'
              ? 'dns'
              : alert.entityType === 'website'
              ? 'language'
              : alert.entityType === 'account'
              ? 'manage_accounts'
              : 'domain'}
          </span>
          <span className="font-label-mono text-label-mono font-bold text-on-surface text-[15px]">
            {alert.domain}
          </span>
        </div>
        <span className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-caption-xs text-caption-xs">
          {alert.entityType === 'server'
            ? 'VPS Node'
            : alert.entityType === 'website'
            ? 'Web App'
            : alert.entityType === 'account'
            ? 'Provider Account'
            : 'ICANN Registered'}
        </span>
      </div>

      {/* Operational Advisory Quote Box */}
      <div className="p-unit-sm rounded-lg bg-surface-container-high text-on-surface flex flex-col gap-unit-2xs border-l-2 border-primary">
        <div className="flex items-center gap-1 text-primary font-caption-xs text-caption-xs font-bold uppercase tracking-wider">
          <span className="material-symbols-outlined text-[14px]">assignment</span> DOMAIN RISK SUMMARY
        </div>
        <p className="font-body-sm text-body-sm text-on-surface italic">
          &ldquo;{alert.advisory}&rdquo;
        </p>
      </div>

      {/* Detailed Metrics Grid */}
      <div className="grid grid-cols-2 gap-unit-sm pt-unit-xs">
        <div className="bg-surface-container-low p-unit-sm rounded-lg flex flex-col border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
            Alert Created
          </span>
          <span className="font-label-mono text-label-mono text-on-surface font-semibold mt-0.5">
            {alert.triggeredDate}
          </span>
        </div>

        <div className="bg-surface-container-low p-unit-sm rounded-lg flex flex-col border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
            Expiry / Due Date
          </span>
          <span
            className={`font-label-mono text-label-mono font-semibold mt-0.5 ${
              alert.severity === 'CRITICAL'
                ? 'text-rose-700'
                : alert.severity === 'WARNING'
                ? 'text-amber-700'
                : 'text-on-surface'
            }`}
          >
            {alert.dueDate}
          </span>
        </div>

        <div className="bg-surface-container-low p-unit-sm rounded-lg flex flex-col border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
            Days Remaining
          </span>
          <span
            className={`font-label-mono text-label-mono font-bold mt-0.5 ${
              alert.daysRemaining <= 7
                ? 'text-rose-700'
                : alert.daysRemaining <= 30
                ? 'text-amber-700'
                : 'text-on-surface'
            }`}
          >
            {alert.daysRemainingLabel}
          </span>
        </div>

        <div className="bg-surface-container-low p-unit-sm rounded-lg flex flex-col border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
            Registrar / Provider
          </span>
          <span className="font-body-sm text-body-sm text-on-surface font-semibold mt-0.5 truncate">
            {alert.registrarOrProvider}
          </span>
        </div>

        <div className="bg-surface-container-low p-unit-sm rounded-lg flex flex-col border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
            Renewal Price
          </span>
          <span className="font-label-mono text-label-mono text-on-surface font-semibold mt-0.5">
            {alert.renewalPriceFormatted || '₹1,299 / yr'}
          </span>
        </div>

        <div className="bg-surface-container-low p-unit-sm rounded-lg flex flex-col border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
            Auto-Renew Status
          </span>
          <span
            className={`font-body-sm text-body-sm font-semibold mt-0.5 ${
              alert.autoRenewIsRisk ? 'text-rose-700' : 'text-secondary'
            }`}
          >
            {alert.autoRenewStatus || 'Off (Risk Detected)'}
          </span>
        </div>
      </div>

      {/* Extended Technical Details */}
      <div className="flex flex-col gap-unit-xs bg-surface-container-low p-unit-sm rounded-lg border border-outline-variant/20">
        <div className="flex items-center justify-between text-body-sm">
          <span className="text-secondary font-caption-xs">Nameservers:</span>
          <span className="font-label-mono text-caption-xs text-on-surface">
            {alert.nameservers || 'ns1.godaddy.com, ns2...'}
          </span>
        </div>
        <div className="flex items-center justify-between text-body-sm">
          <span className="text-secondary font-caption-xs">SSL Status:</span>
          <span className="font-label-mono text-caption-xs text-primary font-medium">
            {alert.sslStatus || 'Active (Stored snapshot)'}
          </span>
        </div>
        <div className="flex items-center justify-between text-body-sm">
          <span className="text-secondary font-caption-xs">Data Source:</span>
          <span className="font-caption-xs text-secondary italic">
            {alert.dataSourceNote || 'Portfolio metadata / stored reference'}
          </span>
        </div>
      </div>

      {/* Action Buttons Cluster */}
      <div className="flex flex-col gap-unit-xs pt-unit-xs">
        <button
          type="button"
          onClick={() => onNavigateToEntity(alert.targetRoute)}
          className="w-full h-9 px-unit-md rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-xs flex items-center justify-center gap-unit-xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          <span>View in Portfolio</span>
        </button>

        <div className="grid grid-cols-2 gap-unit-xs">
          <button
            type="button"
            onClick={() => onSetReminder(alert)}
            className="h-9 px-unit-sm rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1 cursor-pointer border border-outline-variant/20"
          >
            <span className="material-symbols-outlined text-[16px]">alarm_on</span>
            <span>Set Reminder</span>
          </button>

          <button
            type="button"
            onClick={() => onMarkResolved(alert)}
            className="h-9 px-unit-sm rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1 cursor-pointer border border-outline-variant/20"
          >
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>Mark Resolved</span>
          </button>
        </div>
      </div>

      <p className="font-caption-xs text-caption-xs text-center text-secondary">
        DomainPulse calculates alerts from stored portfolio records.
      </p>
    </div>
  );
};
