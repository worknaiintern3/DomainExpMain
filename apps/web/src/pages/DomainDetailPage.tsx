import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProvenanceBadge } from '@/components/common/ProvenanceBadge';

export const DomainDetailPage: React.FC = () => {
  const { domainId } = useParams<{ domainId: string }>();
  const activeDomain = domainId || 'worknai.com';

  return (
    <div className="flex flex-col gap-unit-lg">
      <div className="flex items-center gap-unit-xs text-caption-xs font-caption-xs text-secondary">
        <Link to="/domains" className="hover:text-primary transition-colors">
          My Domains
        </Link>
        <span>/</span>
        <span className="font-mono text-on-surface font-medium">{activeDomain}</span>
      </div>

      <PageHeader
        title={activeDomain}
        badge="Apex Domain"
        description="Domain lifecycle information, registrar authority, DNS zone mapping, SSL certificate telemetry, and infrastructure bindings."
        actions={
          <>
            <Link to="/domains">
              <Button variant="secondary" size="md" iconLeading="arrow_back">
                Back to Domains
              </Button>
            </Link>
            <Button variant="primary" size="md" iconLeading="tune">
              Edit Domain Record
            </Button>
          </>
        }
      />

      {/* Provenance and Status Bar */}
      <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-wrap items-center justify-between gap-unit-sm">
        <div className="flex items-center gap-unit-sm flex-wrap">
          <StatusBadge status="critical" label="Critical (≤7d)" dotPulse />
          <ProvenanceBadge source="RDAP Retrieved" />
          <ProvenanceBadge source="DNS Retrieved" />
          <ProvenanceBadge source="SSL Retrieved" />
          <ProvenanceBadge source="User Mapped" />
        </div>
        <span className="font-mono text-caption-xs text-secondary">
          Domain ID: {activeDomain}
        </span>
      </div>

      {/* Relationship Chain Preview */}
      <div className="p-unit-lg rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro">
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-unit-sm">
          Infrastructure Relationship Chain
        </h3>
        <div className="p-unit-md rounded-lg bg-surface-container-low flex flex-wrap items-center gap-unit-xs text-caption-xs font-caption-xs overflow-x-auto">
          <span className="px-2 py-1 rounded bg-surface-container-lowest font-mono font-medium text-on-surface shadow-micro">
            domains@worknai.com
          </span>
          <span className="material-symbols-outlined text-secondary text-[16px]">arrow_forward</span>
          <span className="px-2 py-1 rounded bg-surface-container-lowest font-medium text-on-surface shadow-micro">
            GoDaddy LLC
          </span>
          <span className="material-symbols-outlined text-secondary text-[16px]">arrow_forward</span>
          <span className="px-2 py-1 rounded bg-primary-container text-white font-mono font-semibold shadow-micro">
            {activeDomain}
          </span>
          <span className="material-symbols-outlined text-secondary text-[16px]">arrow_forward</span>
          <span className="px-2 py-1 rounded bg-surface-container-lowest font-medium text-on-surface shadow-micro">
            Production VPS 01
          </span>
          <span className="material-symbols-outlined text-secondary text-[16px]">arrow_forward</span>
          <span className="px-2 py-1 rounded bg-surface-container-lowest font-medium text-on-surface shadow-micro">
            WorknAi Website
          </span>
        </div>
      </div>
    </div>
  );
};
