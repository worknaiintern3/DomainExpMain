import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProvenanceBadge } from '@/components/common/ProvenanceBadge';

export const ProviderDetailPage: React.FC = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const activeAccount = accountId || 'hostinger-worknai-main';

  return (
    <div className="flex flex-col gap-unit-lg">
      <div className="flex items-center gap-unit-xs text-caption-xs font-caption-xs text-secondary">
        <Link to="/accounts" className="hover:text-primary transition-colors">
          Accounts &amp; Emails
        </Link>
        <span>/</span>
        <span className="font-mono text-on-surface font-medium">{activeAccount}</span>
      </div>

      <PageHeader
        title="WorknAi Hostinger Main"
        badge="Provider Account"
        description="Provider organization credentials, registered owner email, mapped cloud servers, deployed apps, and billing telemetry."
        actions={
          <>
            <Link to="/accounts">
              <Button variant="secondary" size="md" iconLeading="arrow_back">
                Back to Accounts
              </Button>
            </Link>
            <Button variant="primary" size="md" iconLeading="tune">
              Edit Account Config
            </Button>
          </>
        }
      />

      {/* Account Info Strip */}
      <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-wrap items-center justify-between gap-unit-sm">
        <div className="flex items-center gap-unit-sm flex-wrap">
          <div className="flex items-center gap-1 font-mono text-body-sm font-semibold text-primary bg-primary-fixed/40 px-2 py-0.5 rounded">
            <span className="material-symbols-outlined text-[16px]">mail</span>
            <span>infra@worknai.com</span>
          </div>
          <StatusBadge status="healthy" label="Provider Connected" />
          <ProvenanceBadge source="User Mapped" />
        </div>
        <span className="font-mono text-caption-xs text-secondary">
          Account ID: HST-941029
        </span>
      </div>

      {/* Linked Assets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-unit-md">
        <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-1">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-medium">
            Managed Servers
          </span>
          <span className="font-body-md font-bold text-on-surface">3 Cloud VPS Nodes</span>
          <span className="font-caption-xs text-caption-xs text-secondary">Production VPS 01, Staging Node B</span>
        </div>
        <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-1">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-medium">
            Hosted Websites
          </span>
          <span className="font-body-md font-bold text-on-surface">9 Applications</span>
          <span className="font-caption-xs text-caption-xs text-secondary">WorknAi Web, AnyWork Landing</span>
        </div>
        <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-1">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-medium">
            Direct Monthly Spend
          </span>
          <span className="font-mono text-body-md font-bold text-primary">₹2,840 / mo</span>
          <span className="font-caption-xs text-caption-xs text-secondary">Hostinger Cloud Run-Rate</span>
        </div>
      </div>
    </div>
  );
};
