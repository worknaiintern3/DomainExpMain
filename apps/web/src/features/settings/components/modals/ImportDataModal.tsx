import React, { useEffect, useRef, useState } from 'react';

import {
  MAX_IMPORT_ROWS,
  describeImportResult,
  importBackupDomains,
  importDomainNames,
  parseBackupJson,
  parseDomainsCsv,
  refreshInventoryViews,
} from '../../data-transfer';

interface ImportDataModalProps {
  isOpen: boolean;
  format: 'csv' | 'json';
  onClose: () => void;
  onImported: (message: string, description: string, type: 'success' | 'info' | 'error') => void;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const ImportDataModal: React.FC<ImportDataModalProps> = ({
  isOpen,
  format,
  onClose,
  onImported,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json'>(format);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedFormat(format);
    setFile(null);
    setPreview(null);
    setFileError(null);
    setProgress(null);
  }, [isOpen, format]);

  if (!isOpen) return null;

  const accept = selectedFormat === 'csv' ? '.csv' : '.json';
  const handleClose = () => {
    if (!importing) onClose();
  };

  async function handleFile(picked: File | null) {
    setFileError(null);
    setPreview(null);
    setProgress(null);
    if (!picked) {
      setFile(null);
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setFile(null);
      setFileError('This file is larger than 5 MB.');
      return;
    }
    setFile(picked);
    try {
      const text = await picked.text();
      if (selectedFormat === 'csv') {
        const parsed = parseDomainsCsv(text);
        setPreview(
          `${parsed.names.length} domain${parsed.names.length === 1 ? '' : 's'} ready` +
            (parsed.invalid.length > 0 ? `, ${parsed.invalid.length} invalid row${parsed.invalid.length === 1 ? '' : 's'} skipped` : ''),
        );
      } else {
        const parsed = parseBackupJson(text);
        setPreview(
          `${parsed.domains.length} domain${parsed.domains.length === 1 ? '' : 's'} ready` +
            (parsed.invalid.length > 0 ? `, ${parsed.invalid.length} invalid ${parsed.invalid.length === 1 ? 'entry' : 'entries'} skipped` : ''),
        );
      }
    } catch (error) {
      setPreview(null);
      setFileError(error instanceof Error ? error.message : 'This file could not be read.');
    }
  }

  async function handleExecuteImport() {
    if (!file || importing) return;
    setImporting(true);
    setFileError(null);
    try {
      const text = await file.text();
      const total = selectedFormat === 'csv'
        ? parseDomainsCsv(text)
        : parseBackupJson(text);
      const result = selectedFormat === 'csv'
        ? await importDomainNames(
            (total as ReturnType<typeof parseDomainsCsv>).names,
            (done, count) => setProgress({ done, total: count }),
          )
        : await importBackupDomains(
            (total as ReturnType<typeof parseBackupJson>).domains,
            (done, count) => setProgress({ done, total: count }),
          );
      refreshInventoryViews();
      const described = describeImportResult(result, selectedFormat);
      onImported(described.message, described.description, described.type);
      setFile(null);
      setPreview(null);
      setProgress(null);
      onClose();
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'This file could not be imported.');
    } finally {
      setImporting(false);
    }
  }

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
            onClick={handleClose}
            disabled={importing}
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
                void handleFile(null);
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
                void handleFile(null);
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
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => {
            void handleFile(event.target.files?.[0] ?? null);
            event.target.value = '';
          }}
        />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            void handleFile(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => inputRef.current?.click()}
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
              {file ? file.name : 'Drag and drop file here, or browse'}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
              Supports {accept} files up to 5 MB and {MAX_IMPORT_ROWS} rows per import.
            </span>
          </div>
          {preview && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 font-caption-xs text-caption-xs font-mono mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{preview}</span>
            </span>
          )}
          {fileError && (
            <span className="font-caption-xs text-caption-xs text-error mt-1" role="alert">{fileError}</span>
          )}
          {progress && (
            <span className="font-caption-xs text-caption-xs text-secondary mt-1" role="status">
              Importing {progress.done} of {progress.total}…
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
              ? 'CSV needs a domain_name column (domainName or domain also work). Names already in your workspace are skipped.'
              : 'JSON imports missing domains from a DomainPulse domain snapshot (version "1.0"). Existing domains and other resources are not replaced.'}
          </p>
        </div>

        <div className="flex items-center justify-end gap-unit-sm pt-unit-xs border-t border-surface-container-low mt-unit-2xs">
          <button
            type="button"
            onClick={handleClose}
            disabled={importing}
            className="h-9 px-unit-md rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors border border-outline-variant/30 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleExecuteImport()}
            disabled={!file || !preview || importing}
            className="h-9 px-unit-md rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium disabled:opacity-50"
          >
            {importing ? 'Importing…' : 'Import Records'}
          </button>
        </div>
      </div>
    </div>
  );
};
