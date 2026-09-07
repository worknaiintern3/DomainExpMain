import React from 'react';
import { DOMAIN_DATA_SPECS } from '../help.reference';

export const DomainDataSpecsSection: React.FC = () => {
  return (
    <section className="bg-surface-container-lowest rounded-xl p-unit-lg shadow-micro border border-outline-variant/30 flex flex-col gap-unit-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-unit-sm border-b border-surface-container-low gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-primary">
              dns
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
              Technical Data Taxonomy &amp; Field Specs
            </h3>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Detailed breakdown of metadata attributes aggregated across your portfolio.
          </p>
        </div>
        <span className="font-caption-xs text-caption-xs font-mono px-2 py-0.5 rounded bg-surface-container text-secondary shrink-0">
          8 FIELD SPECS
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
        {DOMAIN_DATA_SPECS.map((field, idx) => (
          <div
            key={idx}
            className="p-unit-md rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col gap-unit-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-label-mono text-label-mono text-primary font-bold">
                {field.name}
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-caption-xs text-caption-xs font-mono">
                {field.protocolTag}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary leading-relaxed mt-1">
              {field.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
