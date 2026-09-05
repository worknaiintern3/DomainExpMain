import React from 'react';
import { Link } from 'react-router-dom';
import { DnsMappingRecord } from '../serverDetails.types';

interface DomainMappingsSectionProps {
  mappings: DnsMappingRecord[];
}

export const DomainMappingsSection: React.FC<DomainMappingsSectionProps> = ({ mappings }) => {
  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sm flex flex-col border border-outline-variant/30">
      {/* Card Header */}
      <div className="p-unit-md flex items-center justify-between bg-surface-container-low rounded-t-xl border-b border-outline-variant/30">
        <div className="flex items-center gap-unit-sm">
          <span className="material-symbols-outlined text-primary text-[20px]">hub</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Connected Domains &amp; DNS Mapping
          </h2>
        </div>
      </div>

      {/* Mappings List */}
      <div className="p-unit-md flex flex-col gap-unit-sm">
        {mappings.map((mapping) => (
          <div
            key={mapping.id}
            className="p-unit-sm rounded-lg bg-surface-container-low flex flex-col gap-1 border border-outline-variant/20 hover:border-outline-variant/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <Link
                to={`/domains/${mapping.hostname.replace(/^(api|admin)\./, '')}`}
                className="font-label-mono text-label-mono font-bold text-on-surface hover:text-primary transition-colors truncate"
              >
                {mapping.hostname}
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                <span className="px-unit-xs py-unit-2xs rounded bg-surface-container-high text-primary font-caption-xs text-caption-xs font-semibold border border-primary/20">
                  {mapping.recordType}
                </span>
                <span className="px-unit-xs py-unit-2xs rounded bg-surface-container text-secondary font-caption-xs text-[10px] border border-outline-variant/20 font-medium">
                  {mapping.provenance}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-secondary font-caption-xs text-caption-xs">
              <span className="font-label-mono text-on-surface/80">{mapping.target}</span>
              <span className="font-medium">{mapping.dnsProvider}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
