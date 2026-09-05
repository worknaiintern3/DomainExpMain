import React from 'react';
import clsx from 'clsx';

export interface PageHeaderProps {
  title: string;
  badge?: string | number;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  badge,
  description,
  actions,
  className,
}) => {
  return (
    <div
      className={clsx(
        'flex flex-col lg:flex-row lg:items-center justify-between gap-unit-md mb-unit-lg',
        className
      )}
    >
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-unit-xs flex-wrap">
          <h1 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
            {title}
          </h1>
          {badge !== undefined && (
            <span className="px-unit-xs py-unit-2xs rounded bg-surface-container-high text-primary font-mono text-caption-xs font-semibold uppercase">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="font-body-md text-body-md text-secondary mt-unit-2xs max-w-3xl">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-unit-sm self-start lg:self-center shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
};
