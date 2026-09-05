import React from 'react';
import clsx from 'clsx';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNegative?: boolean;
    label?: string;
  };
  highlight?: 'default' | 'error' | 'warning' | 'primary';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtext,
  icon,
  trend,
  highlight = 'default',
  className,
}) => {
  const highlightStyles = {
    default: 'bg-surface-container-lowest border-outline-variant/60 text-on-surface',
    error: 'bg-surface-container-lowest border-error-container/80 text-error',
    warning: 'bg-surface-container-lowest border-amber-200 text-on-surface',
    primary: 'bg-surface-container-lowest border-primary-fixed text-on-surface',
  }[highlight];

  return (
    <div
      className={clsx(
        'p-unit-md rounded-xl border shadow-micro flex flex-col justify-between transition-all duration-150 relative overflow-hidden group',
        highlightStyles,
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium truncate">
          {title}
        </span>
        {icon && (
          <span className="material-symbols-outlined text-[18px] text-secondary group-hover:text-primary transition-colors shrink-0">
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between mt-unit-xs gap-2">
        <div className="font-display-lg text-headline-md sm:text-display-lg font-semibold tracking-tight text-on-surface tnum">
          {value}
        </div>
        {trend && (
          <div
            className={clsx(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold leading-none shrink-0',
              trend.isPositive && 'bg-emerald-50 text-emerald-800',
              trend.isNegative && 'bg-red-50 text-red-800',
              !trend.isPositive && !trend.isNegative && 'bg-surface-container text-secondary'
            )}
          >
            {trend.isPositive && (
              <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
            )}
            {trend.isNegative && (
              <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
            )}
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      {subtext && (
        <div className="flex items-center justify-between mt-unit-sm pt-unit-xs border-t border-outline-variant/30 text-caption-xs font-caption-xs text-secondary">
          <span className="truncate">{subtext}</span>
        </div>
      )}
    </div>
  );
};
