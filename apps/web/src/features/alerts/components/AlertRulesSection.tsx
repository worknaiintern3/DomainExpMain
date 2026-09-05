import React from 'react';
import { AlertRuleItem } from '../alerts.types';

interface AlertRulesSectionProps {
  rules: AlertRuleItem[];
  onToggleRule: (ruleId: string) => void;
  onEditRule: (rule: AlertRuleItem) => void;
  onAddNewRule: () => void;
}

export const AlertRulesSection: React.FC<AlertRulesSectionProps> = ({
  rules,
  onToggleRule,
  onEditRule,
  onAddNewRule,
}) => {
  return (
    <div className="flex flex-col gap-unit-lg w-full">
      {/* 1. Main Rules Configuration Card */}
      <div className="bg-surface-container-lowest p-unit-lg rounded-xl shadow-micro flex flex-col gap-unit-md border border-outline-variant/30">
        <div className="flex flex-wrap items-center justify-between gap-unit-sm">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Alert Trigger Rules
            </h2>
            <p className="font-caption-xs text-caption-xs text-secondary mt-unit-2xs">
              Configure in-memory evaluation thresholds and alert generation criteria based on stored inventory dates.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddNewRule}
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add Alert Rule</span>
          </button>
        </div>

        {/* Rules List */}
        <div className="flex flex-col divide-y divide-surface-container/50 border border-outline-variant/30 rounded-lg overflow-hidden">
          {rules.map((rule) => {
            const getSeverityBadge = () => {
              if (rule.severity === 'CRITICAL') {
                return 'bg-rose-100 text-rose-800 font-bold';
              }
              if (rule.severity === 'WARNING') {
                return 'bg-amber-100 text-amber-800 font-bold';
              }
              return 'bg-secondary-container text-primary font-bold';
            };

            return (
              <div
                key={rule.id}
                className="p-unit-md bg-surface-container-lowest hover:bg-surface-container-low transition-colors flex flex-wrap items-center justify-between gap-unit-md"
              >
                <div className="flex flex-col gap-1 min-w-[240px] max-w-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-label-md text-label-md text-on-surface font-semibold">
                      {rule.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-caption-xs text-caption-xs ${getSeverityBadge()}`}
                    >
                      {rule.severity}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-caption-xs text-caption-xs">
                      {rule.category}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-secondary">
                    {rule.description}
                  </p>
                  <span className="font-caption-xs text-caption-xs text-secondary italic">
                    Channels: {rule.deliveryChannelHint}
                  </span>
                </div>

                <div className="flex items-center gap-unit-md">
                  <div className="flex items-center gap-2">
                    <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
                      Threshold:
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-container font-label-mono text-label-mono text-on-surface font-semibold">
                      ≤ {rule.thresholdDays} days
                    </span>
                  </div>

                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => onToggleRule(rule.id)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-surface-container peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    <span className="ml-2 font-caption-xs text-caption-xs text-secondary font-medium">
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => onEditRule(rule)}
                    className="h-7 px-unit-sm rounded bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Notification Channels Configuration Section */}
      <div className="bg-surface-container-lowest p-unit-lg rounded-xl shadow-micro flex flex-col gap-unit-md border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">
              hub
            </span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Notification Delivery Channels
            </h2>
          </div>
          <span className="px-unit-xs py-0.5 rounded bg-surface-container text-secondary font-caption-xs text-caption-xs font-medium">
            Channel Status
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-unit-md">
          {/* Channel 1 */}
          <div className="p-unit-md rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between gap-unit-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                In-App Feed
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-caption-xs font-bold">
                Active
              </span>
            </div>
            <p className="font-caption-xs text-secondary">
              Alerts evaluated and presented directly in the DomainPulse workspace UI.
            </p>
            <span className="font-label-mono text-[11px] text-primary font-medium">
              Demo / Local UI State
            </span>
          </div>

          {/* Channel 2 */}
          <div className="p-unit-md rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between gap-unit-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Browser Push
              </span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-caption-xs font-bold">
                Not Connected
              </span>
            </div>
            <p className="font-caption-xs text-secondary">
              Browser push notification delivery requires service worker gateway integration.
            </p>
            <span className="font-label-mono text-[11px] text-secondary font-medium">
              Not Connected
            </span>
          </div>

          {/* Channel 3 */}
          <div className="p-unit-md rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between gap-unit-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Email Dispatch
              </span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-caption-xs font-bold">
                Not Connected
              </span>
            </div>
            <p className="font-caption-xs text-secondary">
              Requires SMTP / transactional email provider gateway configuration.
            </p>
            <span className="font-label-mono text-[11px] text-secondary font-medium">
              Configuration Only
            </span>
          </div>

          {/* Channel 4 */}
          <div className="p-unit-md rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between gap-unit-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                WhatsApp / SMS
              </span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-caption-xs font-bold">
                Not Connected
              </span>
            </div>
            <p className="font-caption-xs text-secondary">
              Requires Twilio / Meta Cloud API business integration.
            </p>
            <span className="font-label-mono text-[11px] text-secondary font-medium">
              Configuration Only
            </span>
          </div>
        </div>

        <p className="font-caption-xs text-caption-xs text-secondary italic mt-1">
          Notification channel selections are stored frontend preferences. External delivery is not connected.
        </p>
      </div>
    </div>
  );
};
