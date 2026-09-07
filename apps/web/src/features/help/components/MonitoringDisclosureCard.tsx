import React from 'react';
import { MONITORING_DISCLOSURE_DATA } from '../help.reference';

export const MonitoringDisclosureCard: React.FC = () => {
  return (
    <section id="sec-monitoring" className="bg-surface-container-lowest rounded-xl p-unit-lg shadow-micro border border-outline-variant/30 scroll-mt-20 flex flex-col gap-unit-md">
      <div className="flex items-center gap-2 pb-unit-sm border-b border-surface-container-low">
        <span className="material-symbols-outlined text-[22px] text-tertiary">
          visibility_off
        </span>
        <div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
            {MONITORING_DISCLOSURE_DATA.headline}
          </h3>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            {MONITORING_DISCLOSURE_DATA.summary}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
        {/* Supported Demo Features */}
        <div className="p-unit-md rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col gap-unit-xs">
          <div className="flex items-center gap-2 text-emerald-800 font-label-md text-label-md font-semibold mb-1">
            <span className="material-symbols-outlined text-[18px] text-emerald-600">
              check_circle
            </span>
            <span>Supported in Current Demo</span>
          </div>
          <ul className="space-y-1.5 font-body-sm text-body-sm text-on-surface">
            {MONITORING_DISCLOSURE_DATA.supportedFeatures.map((feat, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Not Connected Features */}
        <div className="p-unit-md rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-col gap-unit-xs">
          <div className="flex items-center gap-2 text-amber-900 font-label-md text-label-md font-semibold mb-1">
            <span className="material-symbols-outlined text-[18px] text-amber-600">
              link_off
            </span>
            <span>Requires Connected Integrations</span>
          </div>
          <ul className="space-y-1.5 font-body-sm text-body-sm text-on-surface">
            {MONITORING_DISCLOSURE_DATA.notConnectedFeatures.map((feat, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-2 shrink-0" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Truthful Summary Callout */}
      <div className="p-unit-md rounded-lg bg-surface-container flex items-start gap-unit-sm border border-outline-variant/30">
        <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">
          info
        </span>
        <div className="flex flex-col">
          <span className="font-label-md text-label-md text-on-surface font-semibold">
            Operational Truthfulness Principle
          </span>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5 leading-relaxed">
            {MONITORING_DISCLOSURE_DATA.truthfulStatement}
          </p>
        </div>
      </div>
    </section>
  );
};
