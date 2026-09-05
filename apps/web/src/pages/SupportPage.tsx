import React from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { StatusBadge } from '@/components/common/StatusBadge';

export const SupportPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-unit-lg">
      <PageHeader
        title="Help &amp; Support"
        badge="Knowledge Base"
        description="Learn how DomainPulse operates, understand data provenance labels, interpret DNS/SSL telemetry, and troubleshoot portfolio records."
        actions={
          <Button variant="secondary" size="md" iconLeading="mail">
            Contact Support
          </Button>
        }
      />

      {/* Quick FAQ Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
        <div className="p-unit-lg rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-unit-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">verified</span>
            <h4 className="font-headline-sm text-[16px] text-on-surface font-semibold">
              What is Data Provenance?
            </h4>
          </div>
          <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
            Every technical attribute in DomainPulse is attributed to its authentic source: RDAP for registrar lifecycle timestamps, authoritative DNS queries for zone records, TLS inspection for certificates, and User Mapped for infrastructure allocations.
          </p>
          <div className="mt-2 flex gap-1.5 flex-wrap">
            <StatusBadge status="healthy" label="RDAP Protocol" />
            <StatusBadge status="info" label="DNS Anycast" />
          </div>
        </div>

        <div className="p-unit-lg rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-unit-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">hub</span>
            <h4 className="font-headline-sm text-[16px] text-on-surface font-semibold">
              How do Infrastructure Chains Work?
            </h4>
          </div>
          <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
            DomainPulse traces the entire dependency flow from Registered Account Email → Provider Account Organization → Domain / VPS Compute Node → Hosted Web Application → Project Workspace.
          </p>
          <div className="mt-2 flex gap-1.5 flex-wrap">
            <StatusBadge status="neutral" label="Relationship Topology" />
          </div>
        </div>
      </div>
    </div>
  );
};
