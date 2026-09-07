import React from 'react';
import { TROUBLESHOOTING_ITEMS } from '../help.reference';

interface TroubleshootingSectionProps {
  onCopySnippet: (snippet: string) => void;
}

export const TroubleshootingSection: React.FC<TroubleshootingSectionProps> = ({
  onCopySnippet,
}) => {
  return (
    <section id="sec-troubleshooting" className="bg-surface-container-lowest rounded-xl p-unit-lg shadow-micro border border-outline-variant/30 scroll-mt-20 flex flex-col gap-unit-md">
      <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container-low">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-primary">
              build_circle
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
              Troubleshooting &amp; Diagnostics
            </h3>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Quick resolution steps and diagnostic CLI commands for common technical and network lookup errors.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
        {TROUBLESHOOTING_ITEMS.map((item) => {
          const isError = item.severity === 'error';
          const isWarning = item.severity === 'warning';

          return (
            <div
              key={item.id}
              className="p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-unit-xs">
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      isError
                        ? 'text-error'
                        : isWarning
                        ? 'text-amber-600'
                        : 'text-tertiary'
                    }`}
                  >
                    {isError ? 'error' : isWarning ? 'warning' : 'info'}
                  </span>
                  <h4 className="font-label-md text-label-md text-on-surface font-semibold">
                    {item.title}
                  </h4>
                </div>

                <div className="text-body-sm text-secondary space-y-1.5 leading-relaxed mb-unit-sm">
                  <p>
                    <strong className="text-on-surface">Symptom:</strong> {item.symptom}
                  </p>
                  <p>
                    <strong className="text-on-surface">Resolution:</strong> {item.resolution}
                  </p>
                </div>
              </div>

              {item.commandSnippet && (
                <div className="mt-unit-xs pt-unit-xs border-t border-surface-container-high/60">
                  <div className="flex items-center justify-between bg-surface-container-lowest px-2.5 py-1.5 rounded-lg border border-outline-variant/30 font-label-mono text-[11px] text-on-surface overflow-x-auto">
                    <span className="truncate mr-2 font-mono text-primary font-medium">
                      {item.commandSnippet}
                    </span>
                    <button
                      type="button"
                      onClick={() => onCopySnippet(item.commandSnippet!)}
                      className="inline-flex items-center gap-1 text-secondary hover:text-primary font-caption-xs text-caption-xs font-semibold shrink-0 cursor-pointer transition-colors px-1.5 py-0.5 rounded hover:bg-surface-container"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
