import React from 'react';
import { WebsiteSslData } from '../websiteDetails.types';

interface SslCertificateSectionProps {
  ssl: WebsiteSslData;
  onInspectCertificate: () => void;
}

export const SslCertificateSection: React.FC<SslCertificateSectionProps> = ({
  ssl,
  onInspectCertificate,
}) => {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm p-unit-base flex flex-col justify-between border border-outline-variant/30">
      <div className="flex flex-col">
        {/* Section Header */}
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-primary text-[18px]">verified_user</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              SSL &amp; Security
            </h2>
          </div>
          <span className="px-unit-xs py-0.5 rounded bg-surface-container text-primary font-caption-xs text-caption-xs font-semibold border border-outline-variant/20">
            {ssl.provenance}
          </span>
        </div>

        {/* Content Details */}
        <div className="flex flex-col gap-unit-xs mt-unit-sm">
          {/* Status & Days Remaining */}
          <div className="bg-surface-container-low p-unit-sm rounded-lg flex items-center justify-between border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
                SSL Status
              </span>
              <span className="font-label-md text-label-md text-on-surface font-bold flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    ssl.status === 'healthy'
                      ? 'bg-primary'
                      : ssl.status === 'expiring'
                      ? 'bg-amber-500'
                      : 'bg-error'
                  }`}
                />
                {ssl.statusLabel}
              </span>
            </div>
            <div className="text-right">
              <span className="font-caption-xs text-caption-xs text-secondary uppercase">
                Remaining
              </span>
              <span className="font-label-mono text-label-mono text-primary font-bold block text-[13px]">
                {ssl.daysRemaining} Days
              </span>
            </div>
          </div>

          {/* Certificate Metadata */}
          <div className="bg-surface-container-low p-unit-sm rounded-lg flex flex-col gap-1.5 border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-caption-xs text-caption-xs text-secondary uppercase">
                Certificate Issuer
              </span>
              <span className="font-label-mono text-label-mono text-on-surface font-medium text-[11px]">
                {ssl.issuer}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-caption-xs text-caption-xs text-secondary uppercase">
                Common Name
              </span>
              <span className="font-label-mono text-label-mono text-on-surface font-semibold text-[11px]">
                {ssl.commonName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-caption-xs text-caption-xs text-secondary uppercase">
                Expiration Date
              </span>
              <span className="font-label-mono text-label-mono text-on-surface font-medium text-[11px]">
                {ssl.expirationDate}
              </span>
            </div>
          </div>

          {/* Subject Alternative Names (SAN) */}
          <div className="bg-surface-container-low p-unit-sm rounded-lg flex flex-col gap-1 border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
              Subject Alternative Names (SAN)
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {ssl.san.map((name) => (
                <span
                  key={name}
                  className="px-2 py-0.5 rounded bg-surface-container-lowest font-label-mono text-label-mono text-[11px] text-on-surface shadow-sm border border-outline-variant/20"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="pt-unit-sm mt-unit-sm flex items-center justify-between font-caption-xs text-caption-xs text-secondary border-t border-surface-container">
        <span>Stored Certificate Record</span>
        <button
          onClick={onInspectCertificate}
          className="text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
          type="button"
        >
          <span>Inspect Certificate</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};
