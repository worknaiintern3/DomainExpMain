import React from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { MetricCard } from '@/components/common/MetricCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SearchInput } from '@/components/common/SearchInput';
import { Link } from 'react-router-dom';

export const ServersPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-unit-lg">
      <PageHeader
        title="VPS &amp; Servers"
        badge="6 Nodes"
        description="Manage VPS nodes, cloud compute instances, provider accounts, hosted websites, regional datacenters, and monthly run-rates."
        actions={
          <>
            <Button variant="secondary" size="md" iconLeading="file_download">
              Export Fleet
            </Button>
            <Button variant="primary" size="md" iconLeading="add">
              Add Server
            </Button>
          </>
        }
      />

      {/* 6 Bento Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-unit-md">
        <MetricCard title="Total Nodes" value="6" subtext="Multi-provider fleet" icon="dns" />
        <MetricCard title="Active" value="5" subtext="5 of 6 active" highlight="default" />
        <MetricCard title="Attention" value="1" subtext="Renewal in 7 days" highlight="warning" />
        <MetricCard title="Hosted Apps" value="18" subtext="Across 6 nodes" icon="web" />
        <MetricCard title="Monthly Run" value="₹8,450" subtext="Direct billing sum" icon="payments" />
        <MetricCard title="Upcoming Ren" value="2" subtext="Next: 7 & 14 days" icon="event_upcoming" />
      </div>

      {/* Server Item Card to Verify Deep Link to /servers/:serverId */}
      <div className="p-unit-lg rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-unit-md">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-unit-md">
          <div className="max-w-md w-full">
            <SearchInput placeholder="Search server name, IP, provider or hosted website..." />
          </div>
        </div>

        <div className="p-unit-md rounded-lg bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-unit-md">
          <div className="flex items-center gap-unit-sm">
            <div className="w-9 h-9 rounded-lg bg-primary-container/10 text-primary flex items-center justify-center font-mono font-bold text-[12px]">
              SG
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-body-md font-semibold text-on-surface">
                Production VPS 01
              </span>
              <span className="font-mono text-caption-xs text-secondary">
                103.21.58.112 • Hostinger Cloud • Singapore (SIN-01)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-unit-sm">
            <StatusBadge status="healthy" label="Inventory Record" />
            <Link to="/servers/server-vps01">
              <Button variant="secondary" size="sm" iconTrailing="arrow_forward">
                Server Details
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
