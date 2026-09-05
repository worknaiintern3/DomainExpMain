import React from 'react';
import { DomainDetailData } from '../domainDetails.types';

interface SslCertificateSectionProps {
  data: DomainDetailData;
}

export const SslCertificateSection: React.FC<SslCertificateSectionProps> = ({ data }) => {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-unit-lg shadow-sm border border-outline-variant/30">
      {/* Header */}
      <div className="flex items-center justify-between pb-unit-sm mb-unit-md bg-surface-container-low/40 p-unit-sm rounded-lg border border-outline-variant/20">
        <div className="flex items-center gap-unit-xs">
          <span className="material-symbols-outlined text-[#10b981] text-[20px]">
            lock_reset
          </span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            SSL / TLS Certificate
          </h2>
        </div>
        <span className="px-unit-xs py-unit-2xs rounded bg-[#ecfdf5] text-[#065f46] font-caption-xs text-caption-xs font-semibold">
          SSL Retrieved • Valid
        </span>
      </div>

      <div className="space-y-unit-sm">
        {/* Common Name */}
        <div className="flex justify-between items-center p-unit-xs bg-surface-container-low rounded-lg border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs text-secondary">Common Name</span>
          <span className="font-label-mono text-label-mono text-body-sm font-semibold text-on-surface">
            {data.sslCommonName}
          </span>
        </div>

        {/* Certificate Authority */}
        <div className="flex justify-between items-center p-unit-xs bg-surface-container-low rounded-lg border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs text-secondary">
            Certificate Authority
          </span>
          <span className="font-body-sm text-body-sm font-medium text-on-surface text-right">
            {data.sslAuthority}
          </span>
        </div>

        {/* Status */}
        <div className="flex justify-between items-center p-unit-xs bg-surface-container-low rounded-lg border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs text-secondary">Status</span>
          <span className="font-label-mono text-label-mono text-body-sm font-semibold text-[#065f46]">
            {data.sslStatusText}
          </span>
        </div>

        {/* Expiration Progress Box */}
        <div className="p-unit-sm bg-surface-container-low rounded-lg border border-outline-variant/20">
          <div className="flex justify-between items-center mb-1">
            <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold">
              Expiration
            </span>
            <span className="font-caption-xs text-caption-xs text-primary font-bold">
              {data.sslExpirationDate}
            </span>
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden my-2">
            <div
              className="bg-[#10b981] h-full rounded-full"
              style={{ width: `${Math.min(100, Math.max(5, data.sslProgressPercentage))}%` }}
            />
          </div>
          <span className="text-[10px] text-secondary block">
            Stored SSL Reference Record
          </span>
        </div>
      </div>
    </div>
  );
};
