import React from 'react';
import clsx from 'clsx';
import { ProvenanceVariant } from '@/types';

export interface ProvenanceBadgeProps {
  source: ProvenanceVariant;
  className?: string;
}

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({ source, className }) => {
  const styles = {
    'RDAP Retrieved': 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    'DNS Retrieved': 'bg-sky-50 text-sky-700 border-sky-200/80',
    'SSL Retrieved': 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    'User Mapped': 'bg-slate-100 text-slate-700 border-slate-200',
    'Stored Record': 'bg-surface-container text-secondary border-outline-variant/60',
    'Reference Dataset': 'bg-amber-50 text-amber-800 border-amber-200/80',
  }[source] || 'bg-surface-container text-secondary border-outline-variant/60';

  return (
    <span
      className={clsx(
        'inline-flex items-center px-1.5 py-0.5 rounded border font-mono text-[10px] font-semibold leading-none select-none uppercase tracking-wider',
        styles,
        className
      )}
    >
      {source}
    </span>
  );
};
