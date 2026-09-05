import React from 'react';
import { WebsiteSslData } from '../websiteDetails.types';

interface WebsiteSslInspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  ssl: WebsiteSslData;
  appName: string;
}

export const WebsiteSslInspectModal: React.FC<WebsiteSslInspectModalProps> = ({
  isOpen,
  onClose,
  ssl,
  appName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-unit-md animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-xl shadow-2xl p-unit-xl flex flex-col gap-unit-md border border-outline-variant/40 z-10 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">
              verified_user
            </span>
            <div className="flex flex-col">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Stored SSL Certificate Record
              </h3>
              <p className="font-caption-xs text-caption-xs text-secondary">
                Reference certificate properties for {appName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container text-secondary hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Certificate Breakdown */}
        <div className="flex flex-col gap-unit-sm font-body-sm text-body-sm">
          <div className="p-unit-sm rounded-lg bg-surface-container-low flex items-center justify-between border border-outline-variant/20">
            <span className="text-secondary font-caption-xs uppercase font-semibold">
              Reference Status
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-highest text-primary font-mono text-caption-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {ssl.statusLabel} ({ssl.daysRemaining} days remaining)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-unit-xs">
            <div className="p-unit-sm rounded bg-surface-container-low flex flex-col border border-outline-variant/20">
              <span className="font-caption-xs text-caption-xs text-secondary">Issuer Organization</span>
              <span className="font-label-md font-semibold text-on-surface mt-1">{ssl.issuer}</span>
            </div>
            <div className="p-unit-sm rounded bg-surface-container-low flex flex-col border border-outline-variant/20">
              <span className="font-caption-xs text-caption-xs text-secondary">Common Name (CN)</span>
              <span className="font-label-mono font-semibold text-primary mt-1">{ssl.commonName}</span>
            </div>
            <div className="p-unit-sm rounded bg-surface-container-low flex flex-col border border-outline-variant/20">
              <span className="font-caption-xs text-caption-xs text-secondary">Expiration Date</span>
              <span className="font-label-mono font-medium text-on-surface mt-1">{ssl.expirationDate}</span>
            </div>
            <div className="p-unit-sm rounded bg-surface-container-low flex flex-col border border-outline-variant/20">
              <span className="font-caption-xs text-caption-xs text-secondary">Signature Algorithm</span>
              <span className="font-label-mono text-caption-xs text-on-surface mt-1">
                {ssl.signatureAlgorithm || 'SHA-256 with RSA'}
              </span>
            </div>
          </div>

          <div className="p-unit-sm rounded-lg bg-surface-container-low flex flex-col gap-1 border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
              Subject Alternative Names (SAN)
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {ssl.san.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 rounded bg-surface-container-lowest font-label-mono text-label-mono text-[11px] text-on-surface border border-outline-variant/20"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="p-unit-sm rounded-lg bg-surface-container-high/30 flex items-start gap-unit-xs border border-outline-variant/20">
            <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">
              info
            </span>
            <p className="font-caption-xs text-caption-xs text-on-surface-variant leading-relaxed">
              Certificate records reflect stored inventory and provider-synced reference data. DomainPulse does not initiate live TLS handshakes during client page rendering.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end pt-unit-sm border-t border-surface-container">
          <button
            onClick={onClose}
            className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm"
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
