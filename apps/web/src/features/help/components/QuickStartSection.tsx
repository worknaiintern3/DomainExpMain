import React from 'react';
import { Link } from 'react-router-dom';
import { QUICK_START_STEPS } from '../help.reference';

export const QuickStartSection: React.FC = () => {
  return (
    <section id="sec-quick-start" className="flex flex-col gap-unit-md scroll-mt-20">
      <div className="flex items-center justify-between pb-unit-xs border-b border-surface-container-low">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-primary">
            rocket_launch
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
            Quick Start Workflow
          </h3>
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary font-mono">
          7 CORE STEPS
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-unit-md">
        {QUICK_START_STEPS.map((step) => (
          <div
            key={step.step}
            className="bg-surface-container-lowest rounded-xl p-unit-md shadow-micro hover:shadow-md transition-all border border-outline-variant/30 flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-unit-sm">
                <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary font-bold shadow-micro group-hover:bg-primary group-hover:text-on-primary transition-colors">
                  <span className="material-symbols-outlined text-[20px]">
                    {step.icon}
                  </span>
                </div>
                <span className="font-label-mono text-caption-xs font-semibold px-2 py-0.5 rounded-full bg-surface-container-low text-secondary border border-outline-variant/30">
                  Step {step.step}
                </span>
              </div>
              <h4 className="font-label-md text-label-md text-on-surface font-semibold mb-unit-2xs">
                {step.title}
              </h4>
              <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
                {step.description}
              </p>
            </div>

            {step.targetRoute && (
              <div className="pt-unit-md mt-unit-sm border-t border-surface-container-low">
                <Link
                  to={step.targetRoute}
                  className="inline-flex items-center gap-1 font-label-md text-label-md text-primary font-semibold hover:underline"
                >
                  <span>{step.targetLabel || 'Open Module'}</span>
                  <span className="material-symbols-outlined text-[16px]">
                    arrow_forward
                  </span>
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
