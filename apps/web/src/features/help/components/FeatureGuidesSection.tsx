import React from 'react';
import { Link } from 'react-router-dom';
import { FEATURE_GUIDES } from '../help.reference';

export const FeatureGuidesSection: React.FC = () => {
  return (
    <section id="sec-features" className="bg-surface-container-lowest rounded-xl p-unit-lg shadow-micro border border-outline-variant/30 scroll-mt-20 flex flex-col gap-unit-md">
      <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container-low">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-primary">
              auto_stories
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
              Feature Guides &amp; Methodologies
            </h3>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            In-depth guides on discovery algorithms, pricing economics, risk triage, and relationship topology.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-unit-md">
        {FEATURE_GUIDES.map((guide) => (
          <div
            key={guide.id}
            className="p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-unit-xs">
                <div className="w-8 h-8 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-micro">
                  <span className="material-symbols-outlined text-[18px]">
                    {guide.icon}
                  </span>
                </div>
                <Link
                  to={guide.targetRoute}
                  className="inline-flex items-center gap-1 font-label-md text-label-md text-primary font-semibold hover:underline"
                >
                  <span>{guide.targetLabel}</span>
                  <span className="material-symbols-outlined text-[15px]">
                    open_in_new
                  </span>
                </Link>
              </div>

              <h4 className="font-headline-sm text-[16px] text-on-surface font-semibold">
                {guide.title}
              </h4>
              <span className="font-caption-xs text-caption-xs text-secondary mb-unit-xs block">
                {guide.subtitle}
              </span>

              <p className="font-body-sm text-body-sm text-secondary leading-relaxed mb-unit-sm">
                {guide.summary}
              </p>

              <div className="space-y-1 pt-unit-xs border-t border-surface-container-high/60">
                {guide.keyPoints.map((pt, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 font-caption-xs text-caption-xs text-on-surface">
                    <span className="material-symbols-outlined text-primary text-[14px] shrink-0 mt-0.5">
                      check
                    </span>
                    <span>{pt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
