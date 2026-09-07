import React from 'react';
import { AlertsNotificationSettings } from '../../settings.types';

interface AlertsTabProps {
  settings: AlertsNotificationSettings;
  onChange: (updated: Partial<AlertsNotificationSettings>) => void;
  onSave: () => void;
  isSaving: boolean;
  onOpenChannelConfig: (channel: 'email' | 'whatsapp') => void;
}

export const AlertsTab: React.FC<AlertsTabProps> = ({
  settings,
  onChange,
  onSave,
  isSaving,
  onOpenChannelConfig,
}) => {
  return (
    <section className="flex flex-col gap-unit-lg">
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30">
        <div className="flex flex-col pb-unit-md border-b border-surface-container-low">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Renewal &amp; Security Alerts
            </h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-secondary font-caption-xs text-caption-xs font-mono border border-outline-variant/30">
              <span>Preferences: Stored State</span>
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Configure warning horizons, reminder intervals, and notification dispatch channel preferences.
          </p>
        </div>

        <div className="flex flex-col gap-unit-md mt-unit-md">
          {/* Expiration warning thresholds */}
          <div className="flex flex-col gap-unit-sm p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20">
            <span className="font-label-md text-label-md text-on-surface font-medium">
              Alert Classification Thresholds
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-unit-md mt-1">
              <div className="flex flex-col gap-1 p-unit-sm bg-surface-container-lowest rounded-lg shadow-micro border border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-medium">
                    Critical Horizon
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-caption-xs text-caption-xs font-medium">
                    {settings.criticalThreshold}
                  </span>
                </div>
                <span className="font-caption-xs text-caption-xs text-secondary mt-1">
                  Immediate action required for imminent expiry.
                </span>
              </div>

              <div className="flex flex-col gap-1 p-unit-sm bg-surface-container-lowest rounded-lg shadow-micro border border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-medium">
                    Warning Horizon
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-caption-xs text-caption-xs font-medium">
                    {settings.warningThreshold}
                  </span>
                </div>
                <span className="font-caption-xs text-caption-xs text-secondary mt-1">
                  Active monitoring window for upcoming renewal.
                </span>
              </div>

              <div className="flex flex-col gap-1 p-unit-sm bg-surface-container-lowest rounded-lg shadow-micro border border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-medium">
                    Healthy Tier
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-caption-xs text-caption-xs font-medium">
                    {settings.healthyThreshold}
                  </span>
                </div>
                <span className="font-caption-xs text-caption-xs text-secondary mt-1">
                  Sufficient safety buffer across all active domains.
                </span>
              </div>
            </div>
          </div>

          {/* Domain Renewal Warning Intervals */}
          <div className="flex flex-col gap-unit-xs">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Domain Renewal Warning Intervals
            </label>
            <span className="font-caption-xs text-caption-xs text-secondary mb-1">
              Select intervals prior to expiration when alerts should be flagged:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'thirtyDays', label: '30 Days' },
                { key: 'fifteenDays', label: '15 Days' },
                { key: 'sevenDays', label: '7 Days' },
                { key: 'threeDays', label: '3 Days' },
                { key: 'oneDay', label: '1 Day' },
              ].map((item) => {
                const checked =
                  settings.reminderIntervals[
                    item.key as keyof typeof settings.reminderIntervals
                  ];
                return (
                  <label
                    key={item.key}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-label-md text-label-md cursor-pointer transition-colors ${
                      checked
                        ? 'bg-surface-container text-primary border-primary/40 font-semibold shadow-micro'
                        : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        onChange({
                          reminderIntervals: {
                            ...settings.reminderIntervals,
                            [item.key]: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-primary accent-primary w-4 h-4"
                    />
                    <span>{item.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* SSL Certificate Expiration Warnings */}
          <div className="flex flex-col gap-unit-xs pt-unit-xs">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              SSL Certificate Expiration Warnings
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'thirtyDays', label: '30 Days' },
                { key: 'fourteenDays', label: '14 Days' },
                { key: 'sevenDays', label: '7 Days' },
              ].map((item) => {
                const checked =
                  settings.sslReminderIntervals[
                    item.key as keyof typeof settings.sslReminderIntervals
                  ];
                return (
                  <label
                    key={item.key}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-label-md text-label-md cursor-pointer transition-colors ${
                      checked
                        ? 'bg-surface-container text-primary border-primary/40 font-semibold shadow-micro'
                        : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        onChange({
                          sslReminderIntervals: {
                            ...settings.sslReminderIntervals,
                            [item.key]: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-primary accent-primary w-4 h-4"
                    />
                    <span>{item.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Quick Toggles */}
          <div className="space-y-unit-sm pt-unit-xs">
            <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  Auto-Renew Discrepancy Alert
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary">
                  Flags stored domain records nearing expiry when the recorded auto-renew preference is Off or Unknown.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoRenewDiscrepancyAlert}
                  onChange={(e) =>
                    onChange({ autoRenewDiscrepancyAlert: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 peer-checked:bg-primary transition-all"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  DNS Resolution Status Check
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary">
                  Uses stored or retrieved DNS status data to classify DNS resolution risks when available.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.dnsResolutionCheck}
                  onChange={(e) =>
                    onChange({ dnsResolutionCheck: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 peer-checked:bg-primary transition-all"></div>
              </label>
            </div>
          </div>

          {/* Delivery Channels */}
          <div className="flex flex-col gap-unit-xs pt-unit-xs">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Delivery Channels
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-sm">
              {/* In-App Dashboard */}
              <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-tertiary">
                    inbox
                  </span>
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface font-medium">
                      In-App Dashboard Feed
                    </span>
                    <span className="font-caption-xs text-caption-xs text-secondary">
                      Demo UI State
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.channels.inAppDashboard}
                  onChange={(e) =>
                    onChange({
                      channels: {
                        ...settings.channels,
                        inAppDashboard: e.target.checked,
                      },
                    })
                  }
                  className="rounded text-primary accent-primary w-4 h-4"
                />
              </div>

              {/* Browser Push */}
              <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-outline">
                    notifications
                  </span>
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface font-medium">
                      Browser Push Notifications
                    </span>
                    <span className="font-caption-xs text-caption-xs text-secondary">
                      Not Connected
                    </span>
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container-high text-secondary font-caption-xs text-caption-xs font-mono">
                  Not Connected
                </span>
              </div>

              {/* Email */}
              <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-outline">
                    mail
                  </span>
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface font-medium">
                      Email Dispatch
                    </span>
                    <span className="font-caption-xs text-caption-xs text-secondary">
                      Configuration Only (Not Connected)
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChannelConfig('email')}
                  className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-primary font-caption-xs text-caption-xs font-medium transition-colors border border-outline-variant/30 cursor-pointer"
                >
                  Configure
                </button>
              </div>

              {/* WhatsApp */}
              <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-outline">
                    chat
                  </span>
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface font-medium">
                      WhatsApp / SMS Dispatch
                    </span>
                    <span className="font-caption-xs text-caption-xs text-secondary">
                      Configuration Only (Not Connected)
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChannelConfig('whatsapp')}
                  className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-primary font-caption-xs text-caption-xs font-medium transition-colors border border-outline-variant/30 cursor-pointer"
                >
                  Configure
                </button>
              </div>
            </div>
          </div>

          {/* Disclosure Callout */}
          <div className="p-unit-md rounded-xl bg-surface-container-high/40 border border-outline-variant/30 flex items-start gap-3">
            <span className="material-symbols-outlined text-[20px] text-tertiary shrink-0 mt-0.5">
              info
            </span>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Alert Delivery Notice
              </span>
              <p className="font-body-sm text-body-sm text-secondary mt-0.5">
                Notification channel selections are stored frontend preferences. External delivery is not connected.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-unit-lg pt-unit-md border-t border-surface-container-low flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Alert Settings'}
          </button>
        </div>
      </div>
    </section>
  );
};
