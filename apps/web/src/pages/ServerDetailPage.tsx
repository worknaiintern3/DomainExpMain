import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { ProvenanceBadge } from '@/components/common/ProvenanceBadge';

export const ServerDetailPage: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const activeServer = serverId || 'server-vps01';

  return (
    <div className="flex flex-col gap-unit-lg">
      <div className="flex items-center gap-unit-xs text-caption-xs font-caption-xs text-secondary">
        <Link to="/servers" className="hover:text-primary transition-colors">
          VPS &amp; Servers
        </Link>
        <span>/</span>
        <span className="font-mono text-on-surface font-medium">{activeServer}</span>
      </div>

      <PageHeader
        title="Production VPS 01"
        badge="Compute Node"
        description="Hardware specification, datacenter region, mapped provider account, connected websites, and reverse proxy routing."
        actions={
          <>
            <Link to="/servers">
              <Button variant="secondary" size="md" iconLeading="arrow_back">
                Back to Servers
              </Button>
            </Link>
            <Button variant="primary" size="md" iconLeading="tune">
              Edit Server Node
            </Button>
          </>
        }
      />

      {/* Observability Disclaimer Notice */}
      <div className="p-unit-md rounded-xl bg-amber-50 border border-amber-200 text-amber-900 shadow-micro flex items-start gap-unit-sm">
        <span className="material-symbols-outlined text-[20px] text-amber-700 shrink-0 mt-0.5">
          sensors_off
        </span>
        <div className="flex flex-col">
          <div className="flex items-center gap-unit-xs">
            <span className="font-label-md text-label-md font-semibold text-amber-900">
              Server Monitoring: Not Connected
            </span>
            <ProvenanceBadge source="Stored Record" />
          </div>
          <p className="font-caption-xs text-caption-xs text-amber-800 mt-0.5 leading-relaxed">
            Live CPU, RAM, disk, and socket telemetry is not connected. This workspace displays stored server inventory and mapped infrastructure data.
          </p>
        </div>
      </div>

      {/* Specs Bento Preview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-unit-md">
        <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-1">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-medium">Public IP</span>
          <span className="font-mono text-body-md font-bold text-on-surface">103.21.58.112</span>
          <span className="font-caption-xs text-caption-xs text-secondary">Singapore (SIN-01)</span>
        </div>
        <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-1">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-medium">Hardware</span>
          <span className="font-body-md font-bold text-on-surface">4 vCPU · 8 GB RAM</span>
          <span className="font-caption-xs text-caption-xs text-secondary">160 GB NVMe SSD</span>
        </div>
        <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-1">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-medium">Monthly Cost</span>
          <span className="font-mono text-body-md font-bold text-primary">₹1,499 / mo</span>
          <span className="font-caption-xs text-caption-xs text-secondary">Next renewal: 18 Oct 2026</span>
        </div>
        <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-1">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-medium">Hosted Apps</span>
          <span className="font-body-md font-bold text-on-surface">5 Applications</span>
          <span className="font-caption-xs text-caption-xs text-secondary">worknai.com, anywork.in</span>
        </div>
      </div>
    </div>
  );
};
