import React from 'react';
import clsx from 'clsx';
import { StatusVariant } from '@/types';

export interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
  dotPulse?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  dotPulse = false,
  className,
}) => {
  const config = {
    healthy: {
      defaultLabel: 'Healthy',
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      dot: 'bg-emerald-500',
    },
    warning: {
      defaultLabel: 'Warning',
      bg: 'bg-amber-50 border-amber-200 text-amber-900',
      dot: 'bg-amber-500',
    },
    critical: {
      defaultLabel: 'Critical',
      bg: 'bg-red-50 border-red-200 text-red-900',
      dot: 'bg-red-500',
    },
    neutral: {
      defaultLabel: 'Neutral',
      bg: 'bg-surface-container border-outline-variant/60 text-on-surface-variant',
      dot: 'bg-secondary',
    },
    info: {
      defaultLabel: 'Info',
      bg: 'bg-indigo-50 border-indigo-200 text-indigo-900',
      dot: 'bg-primary-container',
    },
  }[status];

  const displayLabel = label || config.defaultLabel;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 h-5 px-2 rounded-full border text-[11px] font-medium leading-none select-none tracking-tight',
        config.bg,
        className
      )}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {dotPulse && (
          <span
            className={clsx(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              config.dot
            )}
          />
        )}
        <span className={clsx('relative inline-flex rounded-full h-1.5 w-1.5', config.dot)} />
      </span>
      <span>{displayLabel}</span>
    </span>
  );
};
