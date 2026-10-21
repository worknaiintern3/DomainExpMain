import React, { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { getInventorySummary, type InventorySummary } from '@/api/inventory';
import { WORKSPACE_SUMMARY_DATA } from '../../settings.reference';
import {
  buildBackup,
  domainsToCsv,
  downloadFile,
  fetchLiveInventory,
  fetchOpenAlertCount,
  refreshInventoryViews,
} from '../../data-transfer';

interface DataManagementTabProps {
  onOpenImportModal: (format: 'csv' | 'json') => void;
  notify: (message: string, description: string, type: 'success' | 'info' | 'error') => void;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.detail;
  return error instanceof Error && error.message ? error.message : fallback;
}

export { refreshInventoryViews };

export const DataManagementTab: React.FC<DataManagementTabProps> = ({
  onOpenImportModal,
  notify,
}) => {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [openAlerts, setOpenAlerts] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'csv' | 'json' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [live, alerts] = await Promise.all([
        getInventorySummary(),
        fetchOpenAlertCount().catch(() => null),
      ]);
      setSummary(live);
      setOpenAlerts(alerts);
    } catch (error) {
      setLoadError(errorMessage(error, 'Inventory counts could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener('domainpulse:inventory-changed', load);
    return () => window.removeEventListener('domainpulse:inventory-changed', load);
  }, [load]);

  async function handleExportCsv() {
    setBusy('csv');
    try {
      const { domains } = await fetchLiveInventory();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(`domainpulse-domains-${stamp}.csv`, domainsToCsv(domains), 'text/csv');
      notify(
        `Exported ${domains.length} domain${domains.length === 1 ? '' : 's'} to CSV.`,
        'Downloaded from your live inventory.',
        'success',
      );
    } catch (error) {
      notify('Export failed.', errorMessage(error, 'The CSV could not be generated.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleExportJson() {
    setBusy('json');
    try {
      const { domains, summary: live } = await fetchLiveInventory();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(`domainpulse-domains-${stamp}.json`, buildBackup(live, domains), 'application/json');
      notify(
        `Exported ${domains.length} domain${domains.length === 1 ? '' : 's'} to JSON.`,
        'Import JSON can add missing domains from this snapshot.',
        'success',
      );
    } catch (error) {
      notify('JSON export failed.', errorMessage(error, 'The domain snapshot could not be generated.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  // Import toasts are described by the import modal via describeImportResult.

  return (
    <section className="flex flex-col gap-unit-lg">
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30">
        <div className="flex flex-col pb-unit-md border-b border-surface-container-low">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Portfolio Data &amp; Storage
            </h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-secondary font-caption-xs text-caption-xs font-mono border border-outline-variant/30">
              <span>Live inventory</span>
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Import and export domains from your live workspace inventory.
          </p>
        </div>

        <div className="flex flex-col gap-unit-lg mt-unit-md">
          {/* Live counts */}
          {loading && (
            <p className="font-body-sm text-body-sm text-secondary" role="status">Loading inventory counts…</p>
          )}
          {!loading && loadError && (
            <div className="rounded-lg border border-error/30 bg-error/5 p-unit-sm" role="alert">
              <p className="font-body-sm text-body-sm text-error">{loadError}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-2 h-8 px-unit-md rounded-lg border border-outline-variant/60 text-on-surface font-label-md text-label-md cursor-pointer"
              >
                Try again
              </button>
            </div>
          )}
          {!loading && !loadError && summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-unit-sm" aria-live="polite">
              {[
                { label: 'Domains', value: summary.domains },
                { label: 'Servers', value: summary.servers },
                { label: 'Websites & Apps', value: summary.applications },
                { label: 'Accounts', value: typeof summary.providerAccounts === 'number' && typeof summary.emailAccounts === 'number' ? summary.providerAccounts + summary.emailAccounts : '—' },
              ].map((stat) => (
                <div key={stat.label} className="p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col">
                  <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">{stat.label}</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold mt-0.5">{stat.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-unit-md">
            {/* Import CSV */}
            <button
              type="button"
              onClick={() => onOpenImportModal('csv')}
              className="p-unit-md rounded-xl bg-surface-container-low flex items-start gap-unit-sm text-left cursor-pointer hover:bg-surface-container transition-colors shadow-micro border border-outline-variant/30 group"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-micro group-hover:scale-105 transition-transform border border-outline-variant/30">
                <span className="material-symbols-outlined text-[20px] text-tertiary">
                  upload_file
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Import CSV
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  Add domains from a CSV file (needs a domain_name column).
                </span>
              </div>
            </button>

            {/* Import JSON */}
            <button
              type="button"
              onClick={() => onOpenImportModal('json')}
              className="p-unit-md rounded-xl bg-surface-container-low flex items-start gap-unit-sm text-left cursor-pointer hover:bg-surface-container transition-colors shadow-micro border border-outline-variant/30 group"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-micro group-hover:scale-105 transition-transform border border-outline-variant/30">
                <span className="material-symbols-outlined text-[20px] text-tertiary">
                  code
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Import JSON
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  Add missing domains from a DomainPulse JSON snapshot.
                </span>
              </div>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => { if (!busy) void handleExportCsv(); }}
              className="p-unit-md rounded-xl bg-surface-container-low flex items-start gap-unit-sm text-left cursor-pointer hover:bg-surface-container transition-colors shadow-micro border border-outline-variant/30 group disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-micro group-hover:scale-105 transition-transform border border-outline-variant/30">
                <span className="material-symbols-outlined text-[20px] text-tertiary">
                  file_download
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  {busy === 'csv' ? 'Exporting…' : 'Export CSV'}
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  Download your live domains as a CSV file.
                </span>
              </div>
            </button>

            {/* Export JSON */}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => { if (!busy) void handleExportJson(); }}
              className="p-unit-md rounded-xl bg-surface-container-low flex items-start gap-unit-sm text-left cursor-pointer hover:bg-surface-container transition-colors shadow-micro border border-outline-variant/30 group disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-micro group-hover:scale-105 transition-transform border border-outline-variant/30">
                <span className="material-symbols-outlined text-[20px] text-tertiary">
                  data_object
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  {busy === 'json' ? 'Backing up…' : 'Export JSON'}
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  Download a domain-only snapshot; other inventory and settings are not included.
                </span>
              </div>
            </button>

          </div>

          {/* Dataset & Storage Breakdown Card */}
          <div className="p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-unit-sm">
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              Active Dataset Summary
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-unit-sm pt-1">
              <div className="p-unit-sm rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col">
                <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
                  Storage Scope
                </span>
                <span className="font-label-md text-label-md text-on-surface font-medium mt-0.5">
                  {WORKSPACE_SUMMARY_DATA.storage}
                </span>
              </div>
              <div className="p-unit-sm rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col">
                <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
                  Data Sources
                </span>
                <span className="font-label-md text-label-md text-on-surface font-medium mt-0.5">
                  {WORKSPACE_SUMMARY_DATA.domainDataSources}
                </span>
              </div>
              <div className="p-unit-sm rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col">
                <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
                  Pricing Source
                </span>
                <span className="font-label-md text-label-md text-on-surface font-medium mt-0.5">
                  {WORKSPACE_SUMMARY_DATA.pricingMode}
                </span>
              </div>
              <div className="p-unit-sm rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col">
                <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
                  Open Alerts
                </span>
                <span className="font-label-md text-label-md text-on-surface font-medium mt-0.5">
                  {openAlerts === null ? '—' : `${openAlerts} open`}
                </span>
              </div>
            </div>
          </div>

          <p className="font-caption-xs text-caption-xs text-secondary">
            JSON import adds missing domains only (up to 200 per file). It does not overwrite existing domains or restore other resource types.
          </p>
        </div>
      </div>
    </section>
  );
};
