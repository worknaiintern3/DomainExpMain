import React from 'react';
import { STATUS_EXPLANATIONS } from '../help.reference';

export const StatusExplanationSection: React.FC = () => {
  const getBadgePill = (statusType: string, label: string) => {
    switch (statusType) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full font-caption-xs text-caption-xs font-semibold bg-error-container text-on-error-container border border-error/30">
            <span className="w-1.5 h-1.5 rounded-full bg-error" />
            <span>{label}</span>
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full font-caption-xs text-caption-xs font-semibold bg-amber-500/10 text-amber-800 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>{label}</span>
          </span>
        );
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full font-caption-xs text-caption-xs font-semibold bg-emerald-500/10 text-emerald-800 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{label}</span>
          </span>
        );
      case 'neutral':
        return (
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full font-caption-xs text-caption-xs font-medium bg-surface-container text-secondary border border-outline-variant/30">
            <span className="w-1.5 h-1.5 rounded-full bg-outline" />
            <span>{label}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full font-caption-xs text-caption-xs font-medium bg-surface-container-high text-outline border border-outline-variant/30">
            <span className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
            <span>{label}</span>
          </span>
        );
    }
  };

  return (
    <section id="sec-status" className="bg-surface-container-lowest rounded-xl p-unit-lg shadow-micro border border-outline-variant/30 scroll-mt-20 flex flex-col gap-unit-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-unit-sm border-b border-surface-container-low">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-primary">
              verified_user
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
              Domain Status Explanations
            </h3>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Standardized health badges across your portfolio. These health levels are calculated based on configured portfolio rules in Settings.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left font-body-sm text-body-sm">
          <thead>
            <tr className="bg-surface-container-low text-secondary font-caption-xs text-caption-xs uppercase tracking-wider border-y border-outline-variant/30">
              <th className="py-2.5 px-3 rounded-l-lg">State Badge</th>
              <th className="py-2.5 px-3">Trigger Condition</th>
              <th className="py-2.5 px-3 rounded-r-lg">Recommended Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low">
            {STATUS_EXPLANATIONS.map((item, idx) => (
              <tr
                key={idx}
                className="hover:bg-surface-container-low/50 transition-colors"
              >
                <td className="py-3 px-3 align-top whitespace-nowrap">
                  {getBadgePill(item.statusType, item.badgeLabel)}
                </td>
                <td className="py-3 px-3 align-top font-label-mono text-label-mono text-on-surface font-medium whitespace-nowrap">
                  {item.triggerCondition}
                </td>
                <td className="py-3 px-3 align-top text-secondary font-body-sm text-body-sm leading-relaxed">
                  {item.recommendedAction}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
