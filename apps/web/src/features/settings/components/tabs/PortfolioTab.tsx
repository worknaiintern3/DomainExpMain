import React from 'react';

import type { PortfolioSettings } from '../../settings.types';

interface PortfolioTabProps {
  settings: PortfolioSettings;
  onChange: (updated: Partial<PortfolioSettings>) => void;
  onSave: () => void;
  isSaving: boolean;
}

const SOURCES: Array<{ key: keyof PortfolioSettings['metadataSources']; label: string; hint: string }> = [
  { key: 'rdap', label: 'RDAP', hint: 'Registration & expiry' },
  { key: 'dns', label: 'DNS', hint: 'Records & nameservers' },
  { key: 'tls', label: 'TLS', hint: 'Certificate validity' },
  { key: 'http', label: 'HTTP', hint: 'Response & headers' },
  { key: 'infra', label: 'Infrastructure', hint: 'Hosting & network' },
];

const segmentClass = (active: boolean) =>
  `px-3 py-1 font-label-md text-label-md rounded transition-colors cursor-pointer ${
    active
      ? 'bg-surface-container-lowest text-primary font-semibold shadow-micro'
      : 'text-secondary hover:text-on-surface'
  }`;

const numberInputClass =
  'h-8 px-2 mt-1 rounded bg-surface-container-low text-on-surface font-label-mono text-label-mono border border-outline-variant/40 focus:ring-2 focus:ring-primary focus:outline-none w-full';

export const PortfolioTab: React.FC<PortfolioTabProps> = ({
  settings,
  onChange,
  onSave,
  isSaving,
}) => {
  const enabledCount = Object.values(settings.metadataSources).filter(Boolean).length;
  const thresholdsValid =
    Number.isInteger(settings.criticalThresholdDays) &&
    Number.isInteger(settings.warningThresholdDays) &&
    settings.criticalThresholdDays >= 1 &&
    settings.criticalThresholdDays <= 365 &&
    settings.warningThresholdDays > settings.criticalThresholdDays &&
    settings.warningThresholdDays <= 730;

  const parseDays = (value: string, fallback: number) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  return (
    <section className="flex flex-col gap-unit-lg">
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30">
        <div className="flex flex-col pb-unit-md border-b border-surface-container-low">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Portfolio Defaults &amp; Behavior
          </h3>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Metadata refresh, new-domain defaults, and the expiry horizons used to colour and label domains across the app.
          </p>
        </div>

        <div className="flex flex-col gap-unit-md mt-unit-md">
          {/* Refresh on open */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-unit-sm p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Metadata Refresh
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                When you open a domain, refresh its metadata automatically if it has not been updated in the last 24 hours.
              </span>
            </div>
            <div className="flex p-0.5 bg-surface-container rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => onChange({ automaticMetadataRefresh: 'on-open' })}
                className={segmentClass(settings.automaticMetadataRefresh === 'on-open')}
              >
                When Opened
              </button>
              <button
                type="button"
                onClick={() => onChange({ automaticMetadataRefresh: 'manual' })}
                className={segmentClass(settings.automaticMetadataRefresh === 'manual')}
              >
                Manual Only
              </button>
            </div>
          </div>

          {/* Sources */}
          <div className="flex flex-col gap-unit-sm p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Metadata Sources
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Sources fetched by &quot;Refresh metadata&quot; and by automatic refresh on a domain page. At least one must stay on.
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-unit-sm">
              {SOURCES.map((source) => {
                const checked = settings.metadataSources[source.key];
                const isLastEnabled = checked && enabledCount === 1;
                return (
                  <label
                    key={source.key}
                    className={`flex items-center gap-2 p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 ${
                      isLastEnabled ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:bg-surface-container-low'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isLastEnabled}
                      onChange={(event) =>
                        onChange({
                          metadataSources: { ...settings.metadataSources, [source.key]: event.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-primary"
                    />
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md text-on-surface font-medium">{source.label}</span>
                      <span className="font-caption-xs text-caption-xs text-secondary">{source.hint}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Auto-fetch on creation */}
          <label className="flex items-center justify-between gap-unit-sm p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20 cursor-pointer">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Fetch Metadata When a Domain Is Added
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Queue a background lookup as soon as you add a domain. Turn off to add domains without any automatic lookup.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoFetchMetadataOnCreation}
              onChange={(event) => onChange({ autoFetchMetadataOnCreation: event.target.checked })}
              className="w-5 h-5 accent-primary shrink-0"
            />
          </label>

          {/* Auto-renew default */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-unit-sm p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Default Auto-Renew for New Domains
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Pre-selected in the Add Domain form. &quot;Unknown&quot; leaves it blank.
              </span>
            </div>
            <div className="flex p-0.5 bg-surface-container rounded-lg shrink-0">
              {(['on', 'off', 'unknown'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange({ defaultAutoRenew: value })}
                  className={segmentClass(settings.defaultAutoRenew === value)}
                >
                  {value === 'on' ? 'On' : value === 'off' ? 'Off' : 'Unknown'}
                </button>
              ))}
            </div>
          </div>

          {/* Thresholds */}
          <div className="flex flex-col gap-unit-sm p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Expiry Risk Horizons
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Domains expiring within these many days are shown as critical or warning in lists and domain pages. Alert rules have separate thresholds.
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-unit-sm">
              <div className="p-unit-sm rounded-lg bg-surface-container-lowest border border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-medium">Critical</span>
                  <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-caption-xs text-caption-xs font-medium">
                    ≤ {settings.criticalThresholdDays} days
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={settings.criticalThresholdDays}
                  onChange={(event) =>
                    onChange({ criticalThresholdDays: parseDays(event.target.value, settings.criticalThresholdDays) })
                  }
                  aria-label="Critical threshold in days"
                  className={numberInputClass}
                />
              </div>
              <div className="p-unit-sm rounded-lg bg-surface-container-lowest border border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-medium">Warning</span>
                  <span className="px-2 py-0.5 rounded-full bg-warning-bg text-warning-text font-caption-xs text-caption-xs font-medium">
                    ≤ {settings.warningThresholdDays} days
                  </span>
                </div>
                <input
                  type="number"
                  min={2}
                  max={730}
                  value={settings.warningThresholdDays}
                  onChange={(event) =>
                    onChange({ warningThresholdDays: parseDays(event.target.value, settings.warningThresholdDays) })
                  }
                  aria-label="Warning threshold in days"
                  className={numberInputClass}
                />
              </div>
              <div className="p-unit-sm rounded-lg bg-surface-container-lowest border border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-medium">Healthy</span>
                  <span className="px-2 py-0.5 rounded-full bg-healthy-bg text-healthy-text font-caption-xs text-caption-xs font-medium">
                    &gt; {settings.warningThresholdDays} days
                  </span>
                </div>
                <p className="font-caption-xs text-caption-xs text-secondary mt-2">
                  Everything beyond the warning horizon.
                </p>
              </div>
            </div>
            {!thresholdsValid && (
              <p role="alert" className="font-caption-xs text-caption-xs text-error">
                Critical must be between 1 and 365 days, and warning must be larger than critical (up to 730).
              </p>
            )}
          </div>
        </div>

        <div className="mt-unit-lg pt-unit-md border-t border-surface-container-low flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !thresholdsValid}
            className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Portfolio Settings'}
          </button>
        </div>
      </div>
    </section>
  );
};
