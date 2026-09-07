import React from 'react';
import { DATA_SOURCES_DETAILS } from '../help.reference';

export const DataSourcesSection: React.FC = () => {
  return (
    <section className="bg-surface-container-lowest rounded-xl p-unit-lg shadow-micro border border-outline-variant/30 flex flex-col gap-unit-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-unit-sm border-b border-surface-container-low gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-primary">
              dataset
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
              Data Sources &amp; Retrieval Methods
            </h3>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            How DomainPulse retrieves, inspects, and structures technical metadata across protocols.
          </p>
        </div>
        <span className="font-caption-xs text-caption-xs font-mono px-2 py-0.5 rounded bg-surface-container text-secondary shrink-0">
          5 PROTOCOL SOURCES
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-unit-md">
        {DATA_SOURCES_DETAILS.map((source) => (
          <div
            key={source.id}
            className="p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-unit-xs">
                <div className="w-8 h-8 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-micro">
                  <span className="material-symbols-outlined text-[18px]">
                    {source.icon}
                  </span>
                </div>
                <span className="font-caption-xs text-caption-xs font-semibold px-2 py-0.5 rounded-full bg-surface-container text-secondary font-mono border border-outline-variant/30">
                  {source.tag}
                </span>
              </div>
              <h4 className="font-label-md text-label-md text-on-surface font-semibold mb-unit-2xs">
                {source.title}
              </h4>
              <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
                {source.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
