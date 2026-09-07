import React, { useState } from 'react';

interface ImportDataModalProps {
  isOpen: boolean;
  format: 'csv' | 'json';
  onClose: () => void;
  onImport: (format: 'csv' | 'json', count: number) => void;
}

export const ImportDataModal: React.FC<ImportDataModalProps> = ({
  isOpen,
  format,
  onClose,
  onImport,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json'>(format);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSimulateSelect = () => {
    setSelectedFileName(
      selectedFormat === 'csv'
        ? 'domains_portfolio_export.csv (14.2 KB)'
        : 'domainpulse_backup_snapshot.json (28.6 KB)'
    );
  };

  const handleExecuteImport = () => {
    onImport(selectedFormat, selectedFormat === 'csv' ? 12 : 42);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl bg-surface-container-lowest p-unit-lg shadow-2xl border border-outline-variant/40 flex flex-col gap-unit-md scale-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-unit-xs border-b border-surface-container-low">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">
                {selectedFormat === 'csv' ? 'upload_file' : 'code'}
              </span>
            </div>
            <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Import Portfolio Data ({selectedFormat.toUpperCase()})
            </h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Format Selector */}
        <div className="flex flex-col gap-1">
          <label className="font-label-md text-label-md text-on-surface font-medium">
            Select Import Format
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedFormat('csv');
                setSelectedFileName(null);
              }}
              className={`p-2.5 rounded-lg font-label-md text-label-md flex items-center justify-between border cursor-pointer transition-colors ${
                selectedFormat === 'csv'
                  ? 'bg-surface-container text-primary font-semibold border-primary/40 shadow-micro'
                  : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">table_rows</span>
                <span>CSV Spreadsheet</span>
              </div>
              {selectedFormat === 'csv' && (
                <span className="material-symbols-outlined text-[16px]">check</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedFormat('json');
                setSelectedFileName(null);
              }}
              className={`p-2.5 rounded-lg font-label-md text-label-md flex items-center justify-between border cursor-pointer transition-colors ${
                selectedFormat === 'json'
                  ? 'bg-surface-container text-primary font-semibold border-primary/40 shadow-micro'
                  : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">data_object</span>
                <span>JSON Snapshot</span>
              </div>
              {selectedFormat === 'json' && (
                <span className="material-symbols-outlined text-[16px]">check</span>
              )}
            </button>
          </div>
        </div>

        {/* Upload Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleSimulateSelect();
          }}
          onClick={handleSimulateSelect}
          className={`p-unit-lg rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-outline-variant/60 bg-surface-container-low/50 hover:bg-surface-container-low'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary shadow-micro">
            <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
          </div>
          <div className="flex flex-col">
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              {selectedFileName ? selectedFileName : 'Drag and drop file here, or browse'}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
              Supports .csv, .json (max demo size: 5 MB)
            </span>
          </div>
          {selectedFileName && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 font-caption-xs text-caption-xs font-mono mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Ready to parse in frontend demo session</span>
            </span>
          )}
        </div>

        {/* Format Guidance */}
        <div className="p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/30 flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px] text-tertiary shrink-0 mt-0.5">
            help_outline
          </span>
          <p className="font-caption-xs text-caption-xs text-secondary leading-normal">
            {selectedFormat === 'csv'
              ? 'Expected CSV headers: domain_name, registrar, expiry_date, auto_renew, nameservers, status.'
              : 'Expected JSON schema: { version: "1.0", domains: [...], servers: [...], tags: [...] }.'}
          </p>
        </div>

        <div className="flex items-center justify-end gap-unit-sm pt-unit-xs border-t border-surface-container-low mt-unit-2xs">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-unit-md rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors border border-outline-variant/30 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteImport}
            className="h-9 px-unit-md rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium"
          >
            Import Records
          </button>
        </div>
      </div>
    </div>
  );
};
