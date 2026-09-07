import React from 'react';
import { DATA_LIMITATIONS_LIST } from '../help.reference';

export const DataLimitationsSection: React.FC = () => {
  return (
    <section id="sec-limitations" className="bg-surface-container-lowest rounded-xl p-unit-lg shadow-micro border border-outline-variant/30 scroll-mt-20 flex flex-col gap-unit-md">
      <div className="flex items-center gap-2 pb-unit-sm border-b border-surface-container-low">
        <span className="material-symbols-outlined text-[22px] text-primary">
          policy
        </span>
        <div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
            Data Limitations &amp; Disclosures
          </h3>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Review the operational boundaries of our automated portfolio data collection and reference pricing models.
          </p>
        </div>
      </div>

      <div className="p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/30">
        <ul className="space-y-3 font-body-sm text-body-sm text-on-surface">
          {DATA_LIMITATIONS_LIST.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
                {item.icon}
              </span>
              <span className="leading-relaxed">{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
