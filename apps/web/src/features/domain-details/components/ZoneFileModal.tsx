import React, { useState } from 'react';

interface ZoneFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: string;
  zoneFileContent?: string;
}

export const ZoneFileModal: React.FC<ZoneFileModalProps> = ({
  isOpen,
  onClose,
  domain,
  zoneFileContent,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const content = zoneFileContent || `; Zone file for ${domain}\n$ORIGIN ${domain}.\n$TTL 3600\n@ IN SOA ns1.cloudflare.com. admin.${domain}. ( 2026090501 7200 3600 1209600 3600 )\n@ IN NS ns1.cloudflare.com.\n@ IN NS ns2.cloudflare.com.\n@ IN A 103.21.58.112\nwww IN CNAME ${domain}.\n`;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-unit-md animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-2xl bg-surface-container-lowest rounded-xl shadow-2xl p-unit-xl flex flex-col gap-unit-md border border-outline-variant/40 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex flex-col">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">description</span>
              <span>BIND Zone File Export</span>
            </h3>
            <p className="font-caption-xs text-caption-xs text-secondary font-label-mono">
              {domain} • Stored / Reference Zone Data
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container text-secondary hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <pre className="p-unit-md bg-inverse-surface text-inverse-on-surface font-label-mono text-caption-xs rounded-lg overflow-x-auto max-h-72 leading-relaxed border border-slate-800 select-all">
          {content}
        </pre>

        <div className="flex items-center justify-between pt-unit-sm border-t border-surface-container">
          <span className="font-caption-xs text-caption-xs text-secondary">
            Stored / Reference Zone Data
          </span>
          <div className="flex items-center gap-unit-xs">
            <button
              onClick={onClose}
              className="h-9 px-unit-lg rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors border border-outline-variant/30"
              type="button"
            >
              Close
            </button>
            <button
              onClick={handleCopy}
              className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm transition-colors flex items-center gap-1.5"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Copied' : 'Copy Zone File'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
