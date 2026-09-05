import React from 'react';

export const ProvenanceSection: React.FC = () => {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-unit-lg shadow-sm border border-outline-variant/30">
      {/* Header */}
      <div className="flex items-center gap-unit-xs mb-unit-sm">
        <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold text-[15px]">
          Data Provenance Engine
        </h3>
      </div>
      <p className="font-caption-xs text-caption-xs text-on-surface-variant mb-unit-md leading-relaxed">
        Attributes across this workspace are categorized by data provenance source to guarantee reference integrity.
      </p>

      {/* Protocol Probes List */}
      <div className="flex flex-col gap-unit-xs font-caption-xs text-caption-xs">
        <div className="flex items-center justify-between p-unit-xs bg-surface-container-low rounded border border-outline-variant/20">
          <span className="font-medium text-on-surface">Registrar &amp; Expiry</span>
          <span className="px-unit-xs py-unit-2xs rounded bg-surface-container text-primary font-label-mono font-semibold border border-outline-variant/20">
            RDAP Retrieved
          </span>
        </div>
        <div className="flex items-center justify-between p-unit-xs bg-surface-container-low rounded border border-outline-variant/20">
          <span className="font-medium text-on-surface">Nameservers &amp; Records</span>
          <span className="px-unit-xs py-unit-2xs rounded bg-surface-container text-primary font-label-mono font-semibold border border-outline-variant/20">
            DNS Retrieved
          </span>
        </div>
        <div className="flex items-center justify-between p-unit-xs bg-surface-container-low rounded border border-outline-variant/20">
          <span className="font-medium text-on-surface">SSL / TLS</span>
          <span className="px-unit-xs py-unit-2xs rounded bg-surface-container text-primary font-label-mono font-semibold border border-outline-variant/20">
            SSL Retrieved
          </span>
        </div>
        <div className="flex items-center justify-between p-unit-xs bg-surface-container-low rounded border border-outline-variant/20">
          <span className="font-medium text-on-surface">Host &amp; Credential Map</span>
          <span className="px-unit-xs py-unit-2xs rounded bg-surface-container text-secondary font-label-mono font-semibold border border-outline-variant/20">
            User Mapped / Stored Record
          </span>
        </div>
      </div>
    </div>
  );
};
