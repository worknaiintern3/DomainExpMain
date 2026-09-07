import React from 'react';
import { WORKSPACE_SUMMARY_DATA } from '../../settings.reference';

interface DataManagementTabProps {
  onOpenImportModal: (format: 'csv' | 'json') => void;
  onExport: (format: 'csv' | 'json') => void;
  onCreateBackup: () => void;
  onRestoreBackup: () => void;
  onResetDemoData: () => void;
  onOpenResetConfirmModal: () => void;
}

export const DataManagementTab: React.FC<DataManagementTabProps> = ({
  onOpenImportModal,
  onExport,
  onCreateBackup,
  onRestoreBackup,
  onResetDemoData,
  onOpenResetConfirmModal,
}) => {
  return (
    <section className="flex flex-col gap-unit-lg">
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30">
        <div className="flex flex-col pb-unit-md border-b border-surface-container-low">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Portfolio Data &amp; Storage
            </h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-secondary font-caption-xs text-caption-xs font-mono border border-outline-variant/30">
              <span>Frontend Demo Session</span>
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Import, export, backup, or reset your portfolio dataset.
          </p>
        </div>

        <div className="flex flex-col gap-unit-lg mt-unit-md">
          {/* Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-unit-md">
            {/* Import CSV */}
            <div
              onClick={() => onOpenImportModal('csv')}
              className="p-unit-md rounded-xl bg-surface-container-low flex items-start gap-unit-sm cursor-pointer hover:bg-surface-container transition-colors shadow-micro border border-outline-variant/30 group"
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
                  Import registrar CSV exports directly into current portfolio.
                </span>
              </div>
            </div>

            {/* Import JSON */}
            <div
              onClick={() => onOpenImportModal('json')}
              className="p-unit-md rounded-xl bg-surface-container-low flex items-start gap-unit-sm cursor-pointer hover:bg-surface-container transition-colors shadow-micro border border-outline-variant/30 group"
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
                  Restore domain JSON dump and snapshot backups.
                </span>
              </div>
            </div>

            {/* Export CSV */}
            <div
              onClick={() => onExport('csv')}
              className="p-unit-md rounded-xl bg-surface-container-low flex items-start gap-unit-sm cursor-pointer hover:bg-surface-container transition-colors shadow-micro border border-outline-variant/30 group"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-micro group-hover:scale-105 transition-transform border border-outline-variant/30">
                <span className="material-symbols-outlined text-[20px] text-tertiary">
                  file_download
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Export CSV
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  Download active 42 domain records and health metrics.
                </span>
              </div>
            </div>

            {/* Export JSON */}
            <div
              onClick={() => onExport('json')}
              className="p-unit-md rounded-xl bg-surface-container-low flex items-start gap-unit-sm cursor-pointer hover:bg-surface-container transition-colors shadow-micro border border-outline-variant/30 group"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-micro group-hover:scale-105 transition-transform border border-outline-variant/30">
                <span className="material-symbols-outlined text-[20px] text-tertiary">
                  data_object
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Export JSON
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  Download full portfolio configuration, alerts, and tags.
                </span>
              </div>
            </div>

            {/* Create Local Backup */}
            <div
              onClick={onCreateBackup}
              className="p-unit-md rounded-xl bg-surface-container-low flex items-start gap-unit-sm cursor-pointer hover:bg-surface-container transition-colors shadow-micro border border-outline-variant/30 group"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-micro group-hover:scale-105 transition-transform border border-outline-variant/30">
                <span className="material-symbols-outlined text-[20px] text-primary">
                  backup
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Create Local Backup
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  Create an in-memory snapshot of current preferences and inventory.
                </span>
              </div>
            </div>

            {/* Restore Local Backup */}
            <div
              onClick={onRestoreBackup}
              className="p-unit-md rounded-xl bg-surface-container-low flex items-start gap-unit-sm cursor-pointer hover:bg-surface-container transition-colors shadow-micro border border-outline-variant/30 group"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-micro group-hover:scale-105 transition-transform border border-outline-variant/30">
                <span className="material-symbols-outlined text-[20px] text-primary">
                  settings_backup_restore
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Restore Backup
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  Restore the latest local session backup state.
                </span>
              </div>
            </div>
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
                  Pricing Mode
                </span>
                <span className="font-label-md text-label-md text-on-surface font-medium mt-0.5">
                  {WORKSPACE_SUMMARY_DATA.pricingMode}
                </span>
              </div>
              <div className="p-unit-sm rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col">
                <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
                  Monitoring State
                </span>
                <span className="font-label-md text-label-md text-on-surface font-medium mt-0.5">
                  {WORKSPACE_SUMMARY_DATA.monitoringState}
                </span>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="p-unit-lg rounded-xl bg-error-container/20 border border-error/30 flex flex-col gap-unit-md shadow-micro">
            <div className="flex items-center gap-2 text-error font-headline-sm text-headline-sm font-semibold">
              <span className="material-symbols-outlined text-[22px]">warning</span>
              <span>Danger Zone</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-error-container">
              Reset your portfolio preferences or restore standard sample data.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md pt-unit-xs">
              {/* Reset Demo Data */}
              <div className="flex flex-col justify-between gap-2 p-unit-md rounded-lg bg-surface-container-lowest border border-outline-variant/30">
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md font-semibold text-on-surface">
                    Reset Portfolio Demo Data
                  </span>
                  <span className="font-caption-xs text-caption-xs text-secondary mt-1">
                    Reload the initial 42 domain records and reference benchmark pricing.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onResetDemoData}
                  className="mt-2 h-9 px-unit-md rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors shadow-micro self-start cursor-pointer font-medium border border-outline-variant/30"
                >
                  Restore Default Dataset
                </button>
              </div>

              {/* Reset Workspace Demo Data (Danger) */}
              <div className="flex flex-col justify-between gap-2 p-unit-md rounded-lg bg-surface-container-lowest border border-error/30">
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md font-semibold text-error">
                    Reset Workspace Demo Data
                  </span>
                  <span className="font-caption-xs text-caption-xs text-secondary mt-1">
                    Permanently clears all custom modified preferences and resets workspace session.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenResetConfirmModal}
                  className="mt-2 h-9 px-unit-md rounded-lg bg-error text-on-error font-label-md text-label-md hover:bg-error/90 transition-colors shadow-micro self-start cursor-pointer font-medium"
                >
                  Reset Workspace Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
