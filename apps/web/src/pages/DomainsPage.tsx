import React from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SearchInput } from '@/components/common/SearchInput';
import { Link } from 'react-router-dom';

export const DomainsPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-unit-lg">
      <PageHeader
        title="My Domains"
        badge="42 Domains"
        description="Manage domain portfolio records, monitor renewal dates, WHOIS details, DNS configurations and SSL certificates."
        actions={
          <>
            <Button variant="secondary" size="md" iconLeading="file_download">
              Export CSV
            </Button>
            <Button variant="primary" size="md" iconLeading="add">
              Add Domain
            </Button>
          </>
        }
      />

      {/* Search & Filter Bar Preview */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl border border-outline-variant/60 shadow-micro flex flex-col md:flex-row items-stretch md:items-center justify-between gap-unit-md">
        <div className="max-w-md w-full">
          <SearchInput placeholder="Search domains, registrars, tags or projects..." />
        </div>
        <div className="flex items-center gap-unit-xs flex-wrap">
          <span className="font-caption-xs text-caption-xs text-secondary font-medium mr-1">Status:</span>
          <span className="px-2.5 py-1 rounded-full bg-primary-container text-white font-caption-xs text-[11px] font-semibold">
            All (42)
          </span>
          <span className="px-2.5 py-1 rounded-full bg-surface-container text-secondary font-caption-xs text-[11px] font-medium hover:bg-surface-container-high transition-colors cursor-pointer">
            Critical (2)
          </span>
          <span className="px-2.5 py-1 rounded-full bg-surface-container text-secondary font-caption-xs text-[11px] font-medium hover:bg-surface-container-high transition-colors cursor-pointer">
            Warning (6)
          </span>
        </div>
      </div>

      {/* Sample Row Card to Verify Deep Link to /domains/:domainId */}
      <div className="p-unit-lg rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-unit-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-unit-sm">
            <span className="font-mono text-body-md font-semibold text-on-surface">
              worknai.com
            </span>
            <StatusBadge status="critical" label="4 Days Left" dotPulse />
            <span className="font-caption-xs text-caption-xs text-secondary font-mono">
              GoDaddy • Auto-Renew: Off
            </span>
          </div>
          <Link to="/domains/worknai.com">
            <Button variant="secondary" size="sm" iconTrailing="arrow_forward">
              Inspect Domain Record
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
