import React from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';

export const InfrastructureMapPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-unit-lg">
      <PageHeader
        title="Infrastructure Map"
        badge="Interactive Topology"
        description="Explore how emails, provider accounts, domains, websites, and server nodes are interconnected across your portfolio."
        actions={
          <>
            <Button variant="secondary" size="md" iconLeading="refresh">
              Reset Layout
            </Button>
            <Button variant="secondary" size="md" iconLeading="center_focus_strong">
              Focus Mode
            </Button>
            <Button variant="primary" size="md" iconLeading="add_link">
              Add Relationship
            </Button>
          </>
        }
      />

      {/* Canvas Area Placeholder */}
      <div className="h-[560px] rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col items-center justify-center text-center p-unit-xl relative overflow-hidden">
        {/* Subtle grid backdrop */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="w-14 h-14 rounded-2xl bg-primary-container/10 flex items-center justify-center text-primary mb-unit-sm z-10">
          <span className="material-symbols-outlined text-[32px]">hub</span>
        </div>
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold z-10">
          Infrastructure Topology Map
        </h3>
        <p className="font-body-sm text-body-sm text-secondary max-w-md mt-unit-xs z-10">
          Visual interactive graph illustrating relationships between provider accounts, domain names, DNS records, compute servers, and web applications.
        </p>
      </div>
    </div>
  );
};
