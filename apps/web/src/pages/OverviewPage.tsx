import React from 'react';
import { PageHeader } from '@/components/common/PageHeader';

export const OverviewPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-unit-lg">
      <PageHeader
        title="Overview"
        description="Unified portfolio dashboard across domains, compute nodes, web applications, and provider accounts."
      />

      {/* Neutral Workspace Placeholder Card */}
      <div className="p-unit-xl rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col items-center justify-center text-center py-16">
        <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary mb-unit-sm">
          <span className="material-symbols-outlined text-[28px]">grid_view</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
          Overview Workspace
        </h2>
        <p className="font-body-sm text-body-sm text-secondary max-w-md mt-unit-xs">
          Select a section from the sidebar navigation to view and manage your infrastructure portfolio.
        </p>
      </div>
    </div>
  );
};
