import React from 'react';
import { PortfolioSettings } from '../../settings.types';

interface PortfolioTabProps {
  settings: PortfolioSettings;
  onChange: (updated: Partial<PortfolioSettings>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const PortfolioTab: React.FC<PortfolioTabProps> = ({
  settings,
  onChange,
  onSave,
  isSaving,
}) => {
  return (
    <section className="flex flex-col gap-unit-lg">
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30">
        <div className="flex flex-col pb-unit-md border-b border-surface-container-low">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Portfolio Defaults &amp; Behavior
            </h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-secondary font-caption-xs text-caption-xs font-mono border border-outline-variant/30">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              <span>Monitoring: Not Connected</span>
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Configure metadata fetching, relationship display, renewal assumptions, and risk horizons.
          </p>
        </div>

        <div className="flex flex-col gap-unit-md mt-unit-md">
          {/* Automatic Metadata Refresh */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-unit-sm p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Automatic Metadata Refresh
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Controls when configured metadata sources are refreshed when integrations are available.
              </span>
            </div>
            <div className="inline-flex p-1 bg-surface-container-high rounded-lg border border-outline-variant/30">
              <button
                type="button"
                onClick={() => onChange({ automaticMetadataRefresh: 'on-start' })}
                className={`px-3 py-1 font-label-md text-label-md rounded transition-colors cursor-pointer ${
                  settings.automaticMetadataRefresh === 'on-start'
                    ? 'bg-surface-container-lowest text-primary font-semibold shadow-micro'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                On App Start
              </button>
              <button
                type="button"
                onClick={() => onChange({ automaticMetadataRefresh: 'manual' })}
                className={`px-3 py-1 font-label-md text-label-md rounded transition-colors cursor-pointer ${
                  settings.automaticMetadataRefresh === 'manual'
                    ? 'bg-surface-container-lowest text-primary font-semibold shadow-micro'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                Manual Only
              </button>
            </div>
          </div>

          {/* Domain Metadata Sources */}
          <div className="flex flex-col gap-unit-xs p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex flex-col mb-1">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Domain Metadata Sources
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Select protocol sources used to query domain registration, nameservers, and certificates.
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 cursor-pointer hover:bg-surface-container-low transition-colors">
                <input
                  type="checkbox"
                  checked={settings.domainMetadataSources.rdap}
                  onChange={(e) =>
                    onChange({
                      domainMetadataSources: {
                        ...settings.domainMetadataSources,
                        rdap: e.target.checked,
                      },
                    })
                  }
                  className="rounded text-primary accent-primary w-4 h-4"
                />
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-medium">RDAP</span>
                  <span className="font-caption-xs text-caption-xs text-secondary">Registration &amp; Expiry</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 cursor-pointer hover:bg-surface-container-low transition-colors">
                <input
                  type="checkbox"
                  checked={settings.domainMetadataSources.dns}
                  onChange={(e) =>
                    onChange({
                      domainMetadataSources: {
                        ...settings.domainMetadataSources,
                        dns: e.target.checked,
                      },
                    })
                  }
                  className="rounded text-primary accent-primary w-4 h-4"
                />
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-medium">DNS</span>
                  <span className="font-caption-xs text-caption-xs text-secondary">Nameservers &amp; IPs</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 cursor-pointer hover:bg-surface-container-low transition-colors">
                <input
                  type="checkbox"
                  checked={settings.domainMetadataSources.ssl}
                  onChange={(e) =>
                    onChange({
                      domainMetadataSources: {
                        ...settings.domainMetadataSources,
                        ssl: e.target.checked,
                      },
                    })
                  }
                  className="rounded text-primary accent-primary w-4 h-4"
                />
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-medium">SSL</span>
                  <span className="font-caption-xs text-caption-xs text-secondary">TLS Cert Validity</span>
                </div>
              </label>
            </div>
          </div>

          {/* Relationship Display Mode & Default Infrastructure View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface font-medium">
                Relationship Display Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ relationshipDisplayMode: 'mapped' })}
                  className={`p-2.5 rounded-lg font-label-md text-label-md flex items-center justify-between border cursor-pointer transition-colors ${
                    settings.relationshipDisplayMode === 'mapped'
                      ? 'bg-surface-container text-primary font-semibold border-primary/40 shadow-micro'
                      : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container'
                  }`}
                >
                  <span>Mapped Relationships</span>
                  {settings.relationshipDisplayMode === 'mapped' && (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ relationshipDisplayMode: 'all' })}
                  className={`p-2.5 rounded-lg font-label-md text-label-md flex items-center justify-between border cursor-pointer transition-colors ${
                    settings.relationshipDisplayMode === 'all'
                      ? 'bg-surface-container text-primary font-semibold border-primary/40 shadow-micro'
                      : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container'
                  }`}
                >
                  <span>All Entities</span>
                  {settings.relationshipDisplayMode === 'all' && (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  )}
                </button>
              </div>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Filter out unlinked entities on graph &amp; matrix views.
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface font-medium">
                Default Infrastructure View
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ defaultInfrastructureView: 'inventory' })}
                  className={`p-2.5 rounded-lg font-label-md text-label-md flex items-center justify-between border cursor-pointer transition-colors ${
                    settings.defaultInfrastructureView === 'inventory'
                      ? 'bg-surface-container text-primary font-semibold border-primary/40 shadow-micro'
                      : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container'
                  }`}
                >
                  <span>Inventory</span>
                  {settings.defaultInfrastructureView === 'inventory' && (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ defaultInfrastructureView: 'compact' })}
                  className={`p-2.5 rounded-lg font-label-md text-label-md flex items-center justify-between border cursor-pointer transition-colors ${
                    settings.defaultInfrastructureView === 'compact'
                      ? 'bg-surface-container text-primary font-semibold border-primary/40 shadow-micro'
                      : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container'
                  }`}
                >
                  <span>Compact Matrix</span>
                  {settings.defaultInfrastructureView === 'compact' && (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  )}
                </button>
              </div>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Default layout preference for servers and host views.
              </span>
            </div>
          </div>

          {/* Auto-renew assumption */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-unit-sm p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Default Auto-Renew Assumption
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Assumed renewal posture for freshly recorded domain assets.
              </span>
            </div>
            <div className="inline-flex p-1 bg-surface-container-high rounded-lg border border-outline-variant/30">
              <button
                type="button"
                onClick={() => onChange({ defaultAutoRenewAssumption: 'on' })}
                className={`px-3 py-1 font-label-md text-label-md rounded transition-colors cursor-pointer ${
                  settings.defaultAutoRenewAssumption === 'on'
                    ? 'bg-surface-container-lowest text-primary font-semibold shadow-micro'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                On
              </button>
              <button
                type="button"
                onClick={() => onChange({ defaultAutoRenewAssumption: 'off' })}
                className={`px-3 py-1 font-label-md text-label-md rounded transition-colors cursor-pointer ${
                  settings.defaultAutoRenewAssumption === 'off'
                    ? 'bg-surface-container-lowest text-primary font-semibold shadow-micro'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                Off
              </button>
              <button
                type="button"
                onClick={() => onChange({ defaultAutoRenewAssumption: 'unknown' })}
                className={`px-3 py-1 font-label-md text-label-md rounded transition-colors cursor-pointer ${
                  settings.defaultAutoRenewAssumption === 'unknown'
                    ? 'bg-surface-container-lowest text-primary font-semibold shadow-micro'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                Unknown
              </button>
            </div>
          </div>

          {/* Expiration warning thresholds */}
          <div className="flex flex-col gap-unit-sm p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/20">
            <span className="font-label-md text-label-md text-on-surface font-medium">
              Health &amp; Expiry Risk Horizons
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-unit-md mt-1">
              {/* Critical */}
              <div className="flex flex-col gap-1 p-unit-sm bg-surface-container-lowest rounded-lg shadow-micro border border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-medium">
                    Critical Flag
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-caption-xs text-caption-xs font-medium">
                    ≤ {settings.criticalThresholdDays} days
                  </span>
                </div>
                <input
                  type="number"
                  value={settings.criticalThresholdDays}
                  onChange={(e) =>
                    onChange({ criticalThresholdDays: parseInt(e.target.value, 10) || 7 })
                  }
                  className="h-8 px-2 mt-1 rounded bg-surface-container-low text-on-surface font-label-mono text-label-mono border border-outline-variant/40 focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Warning */}
              <div className="flex flex-col gap-1 p-unit-sm bg-surface-container-lowest rounded-lg shadow-micro border border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-medium">
                    Warning Flag
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-caption-xs text-caption-xs font-medium">
                    8–{settings.warningThresholdDays} days
                  </span>
                </div>
                <input
                  type="number"
                  value={settings.warningThresholdDays}
                  onChange={(e) =>
                    onChange({ warningThresholdDays: parseInt(e.target.value, 10) || 30 })
                  }
                  className="h-8 px-2 mt-1 rounded bg-surface-container-low text-on-surface font-label-mono text-label-mono border border-outline-variant/40 focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Healthy */}
              <div className="flex flex-col gap-1 p-unit-sm bg-surface-container-lowest rounded-lg shadow-micro border border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-medium">
                    Healthy Tier
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-caption-xs text-caption-xs font-medium">
                    &gt; {settings.healthyThresholdDays} days
                  </span>
                </div>
                <span className="font-caption-xs text-caption-xs text-secondary mt-2">
                  Optimal horizon with sufficient renewal safety buffer.
                </span>
              </div>
            </div>
          </div>

          {/* Default Project Tag */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Default Project / Category Tag
            </label>
            <input
              type="text"
              value={settings.defaultCategoryTag}
              onChange={(e) => onChange({ defaultCategoryTag: e.target.value })}
              placeholder="e.g. Core Portfolio, SaaS Platform, Parking"
              className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/40 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-micro"
            />
            <span className="font-caption-xs text-caption-xs text-secondary">
              Applied automatically when creating new domain and server entries.
            </span>
          </div>

          {/* Explicit Disclosure Callout */}
          <div className="p-unit-md rounded-xl bg-surface-container-high/40 border border-outline-variant/30 flex items-start gap-3">
            <span className="material-symbols-outlined text-[20px] text-tertiary shrink-0 mt-0.5">
              info
            </span>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Portfolio Data Disclosure
              </span>
              <p className="font-body-sm text-body-sm text-secondary mt-0.5">
                DomainPulse currently stores portfolio inventory and relationship data. Runtime monitoring requires a connected monitoring integration.
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
            {isSaving ? 'Saving...' : 'Save Portfolio Settings'}
          </button>
        </div>
      </div>
    </section>
  );
};
