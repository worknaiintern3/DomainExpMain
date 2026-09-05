import React from 'react';
import { AlertItem, AlertSeverity, RenewalHorizonItem } from '../alerts.types';
import { AlertsToolbar } from './AlertsToolbar';
import { AlertRow } from './AlertRow';

interface ActiveAlertsFeedProps {
  alerts: AlertItem[];
  criticalCards: AlertItem[];
  renewalHorizons: RenewalHorizonItem[];
  selectedAlertId: string | null;
  onSelectAlert: (alert: AlertItem) => void;
  onSetReminder: (alert: AlertItem, e: React.MouseEvent) => void;
  onMarkResolved?: (alert: AlertItem, e: React.MouseEvent) => void;
  severityFilter: AlertSeverity | 'ALL';
  onSeverityChange: (sev: AlertSeverity | 'ALL') => void;
  unreadOnly: boolean;
  onToggleUnread: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedType: string;
  onTypeChange: (t: string) => void;
  selectedRegistrar: string;
  onRegistrarChange: (r: string) => void;
  counts: {
    all: number;
    critical: number;
    warning: number;
    upcoming: number;
    resolved: number;
    unread: number;
  };
  onResetFilters: () => void;
}

export const ActiveAlertsFeed: React.FC<ActiveAlertsFeedProps> = ({
  alerts,
  criticalCards,
  renewalHorizons,
  selectedAlertId,
  onSelectAlert,
  onSetReminder,
  onMarkResolved,
  severityFilter,
  onSeverityChange,
  unreadOnly,
  onToggleUnread,
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedRegistrar,
  onRegistrarChange,
  counts,
  onResetFilters,
}) => {
  return (
    <div className="flex flex-col gap-unit-lg w-full">
      {/* 1. Critical Action Panel (When Critical Alerts Exist) */}
      {criticalCards.length > 0 && (
        <div className="bg-surface-container-lowest p-unit-lg rounded-xl shadow-micro flex flex-col gap-unit-md border border-rose-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-unit-xs">
              <span className="material-symbols-outlined text-rose-700 text-[20px]">
                fmd_bad
              </span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                {criticalCards.length} domains require immediate action
              </h2>
            </div>
            <span className="px-unit-xs py-0.5 rounded-full bg-rose-100 text-rose-800 font-caption-xs text-caption-xs font-bold uppercase tracking-wider">
              Action Required
            </span>
          </div>

          {/* Action Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
            {criticalCards.map((card) => (
              <div
                key={card.id}
                className="bg-surface-container-low p-unit-md rounded-lg flex flex-col justify-between gap-unit-md hover:bg-surface-container transition-colors border border-outline-variant/30"
              >
                <div className="flex flex-col gap-unit-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-label-mono text-label-mono font-bold text-on-surface text-[15px]">
                      {card.domain}
                    </span>
                    <span className="px-unit-xs py-0.5 rounded-full bg-rose-100 text-rose-800 font-caption-xs text-caption-xs font-bold">
                      {card.daysRemainingLabel}
                    </span>
                  </div>

                  <p className="font-body-sm text-body-sm text-secondary">
                    Expires {card.dueDate} ·{' '}
                    <span className="text-rose-700 font-medium">
                      Auto-renew: {card.autoRenewStatus || 'Off'}
                    </span>{' '}
                    · {card.registrarOrProvider}
                  </p>

                  <div className="flex items-center gap-unit-xs text-secondary mt-unit-2xs text-caption-xs">
                    <span className="material-symbols-outlined text-[14px] text-amber-600">
                      info
                    </span>
                    <span>{card.riskInsight}</span>
                  </div>
                </div>

                <div className="flex items-center gap-unit-xs pt-unit-xs border-t border-surface-container/60">
                  <button
                    type="button"
                    onClick={() => onSelectAlert(card)}
                    className="h-8 px-unit-md rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-xs cursor-pointer"
                  >
                    Review Domain
                  </button>
                  <button
                    type="button"
                    onClick={(e) => onSetReminder(card, e)}
                    className="h-8 px-unit-sm rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md border border-outline-variant/30 cursor-pointer"
                  >
                    Set Reminder
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Filter & Search Toolbar */}
      <AlertsToolbar
        severityFilter={severityFilter}
        onSeverityChange={onSeverityChange}
        unreadOnly={unreadOnly}
        onToggleUnread={onToggleUnread}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        selectedType={selectedType}
        onTypeChange={onTypeChange}
        selectedRegistrar={selectedRegistrar}
        onRegistrarChange={onRegistrarChange}
        counts={counts}
      />

      {/* 3. Alerts Data Table Feed */}
      <div className="bg-surface-container-lowest rounded-xl shadow-micro overflow-hidden border border-outline-variant/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low h-8 text-secondary font-caption-xs text-caption-xs uppercase tracking-wider border-b border-outline-variant/30">
                <th className="px-unit-md py-unit-xs font-semibold">Severity</th>
                <th className="px-unit-md py-unit-xs font-semibold">Type</th>
                <th className="px-unit-md py-unit-xs font-semibold">Domain / Entity</th>
                <th className="px-unit-md py-unit-xs font-semibold">Risk Insight</th>
                <th className="px-unit-md py-unit-xs font-semibold">Triggered</th>
                <th className="px-unit-md py-unit-xs font-semibold">Due Date</th>
                <th className="px-unit-md py-unit-xs font-semibold">Status</th>
                <th className="px-unit-md py-unit-xs font-semibold text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-0 text-body-sm font-body-sm">
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    isSelected={selectedAlertId === alert.id}
                    onSelect={onSelectAlert}
                    onSetReminder={onSetReminder}
                    onMarkResolved={onMarkResolved}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-unit-xl px-unit-md text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[28px] text-secondary">
                        filter_list_off
                      </span>
                      <p className="font-label-md text-on-surface font-semibold">
                        No alerts match your current filter criteria
                      </p>
                      <p className="font-caption-xs text-secondary">
                        Try adjusting your severity filter, search query, or unread toggle.
                      </p>
                      <button
                        type="button"
                        onClick={onResetFilters}
                        className="mt-1 h-7 px-unit-md rounded bg-surface-container text-primary font-label-md text-label-md hover:bg-surface-container-high transition-colors cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Upcoming Renewal Horizon Section */}
      <div className="bg-surface-container-lowest p-unit-lg rounded-xl shadow-micro flex flex-col gap-unit-md border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">timelapse</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Upcoming Renewal Horizon
            </h2>
          </div>
          <span className="font-caption-xs text-caption-xs text-secondary font-label-mono">
            Portfolio Renewal Exposure: ₹25,047 est.
          </span>
        </div>

        {/* Horizon Timeline Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-unit-md">
          {renewalHorizons.map((horizon) => {
            const getSeverityColor = () => {
              if (horizon.severity === 'error') return 'text-rose-700';
              if (horizon.severity === 'warning') return 'text-amber-700';
              return 'text-secondary';
            };
            const getDotColor = () => {
              if (horizon.severity === 'error') return 'bg-rose-600';
              if (horizon.severity === 'warning') return 'bg-amber-500';
              if (horizon.severity === 'primary') return 'bg-primary';
              return 'bg-secondary';
            };
            const getProgressColor = () => {
              if (horizon.severity === 'error') return 'bg-rose-600';
              if (horizon.severity === 'warning') return 'bg-amber-500';
              if (horizon.severity === 'primary') return 'bg-primary';
              return 'bg-secondary';
            };

            return (
              <div
                key={horizon.id}
                className="bg-surface-container-low p-unit-md rounded-lg flex flex-col justify-between gap-unit-sm border border-outline-variant/20"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-caption-xs text-caption-xs font-semibold uppercase tracking-wider ${getSeverityColor()}`}
                  >
                    {horizon.label}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${getDotColor()}`} />
                </div>

                <div className="flex flex-col">
                  <span className="font-headline-md text-headline-md text-on-surface font-bold">
                    {horizon.domainsCount}{' '}
                    <span className="text-body-sm font-normal text-secondary">domains</span>
                  </span>
                  <span className="font-label-mono text-label-mono text-secondary text-[11px]">
                    {horizon.estimatedCostFormatted}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getProgressColor()}`}
                    style={{ width: `${horizon.progressPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Renewal Reminders Configuration / Stored Rules Preview */}
      <div className="bg-surface-container-lowest p-unit-lg rounded-xl shadow-micro flex flex-col gap-unit-md border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">
              notifications_active
            </span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Renewal Reminders Configuration
            </h2>
          </div>
          <span className="px-unit-xs py-0.5 rounded bg-surface-container text-secondary font-caption-xs text-caption-xs font-medium">
            Stored Preferences
          </span>
        </div>

        <div className="flex flex-col gap-unit-md">
          <div>
            <span className="font-label-md text-label-md text-on-surface block mb-unit-xs font-medium">
              Notify before expiry:
            </span>
            <div className="flex flex-wrap items-center gap-unit-xs">
              {['30 Days', '15 Days', '7 Days', '3 Days', '1 Day'].map((day) => (
                <label
                  key={day}
                  className="px-unit-sm py-1 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-mono text-label-mono cursor-pointer flex items-center gap-1 select-none border border-outline-variant/30"
                >
                  <input
                    type="checkbox"
                    defaultChecked
                    className="accent-primary cursor-pointer w-3.5 h-3.5"
                  />
                  <span>{day}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="font-label-md text-label-md text-on-surface block mb-unit-xs font-medium">
              Delivery Channels:
            </span>
            <div className="flex flex-wrap items-center gap-unit-xs">
              <span className="inline-flex items-center gap-1 px-unit-sm py-1 rounded-lg bg-secondary-container text-primary font-caption-xs text-caption-xs font-semibold">
                <span className="material-symbols-outlined text-[14px]">check</span> In-App Dashboard — Demo UI State
              </span>
              <span className="inline-flex items-center gap-1 px-unit-sm py-1 rounded-lg bg-surface-container text-secondary font-caption-xs text-caption-xs border border-outline-variant/30">
                Browser Push — Not Connected
              </span>
              <span className="inline-flex items-center gap-1 px-unit-sm py-1 rounded-lg bg-surface-container text-secondary font-caption-xs text-caption-xs border border-outline-variant/30">
                Email — Configuration Only (Not Connected)
              </span>
              <span className="inline-flex items-center gap-1 px-unit-sm py-1 rounded-lg bg-surface-container text-secondary font-caption-xs text-caption-xs border border-outline-variant/30">
                WhatsApp — Configuration Only (Not Connected)
              </span>
            </div>
          </div>

          <p className="font-caption-xs text-caption-xs text-secondary italic">
            Notification channel selections are stored frontend preferences. External delivery is not connected.
          </p>
        </div>
      </div>
    </div>
  );
};
