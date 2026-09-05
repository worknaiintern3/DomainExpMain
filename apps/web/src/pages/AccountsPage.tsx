import React, { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { MetricCard } from '@/components/common/MetricCard';
import { SearchInput } from '@/components/common/SearchInput';
import { Link } from 'react-router-dom';

export const AccountsPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');

  return (
    <div className="flex flex-col gap-unit-lg">
      <PageHeader
        title="Accounts &amp; Emails"
        badge="4 Primary Emails"
        description="Organize provider accounts by registered email address, track multi-provider infrastructure ownership, and audit asset linkages."
        actions={
          <>
            <Button variant="secondary" size="md" iconLeading="file_download">
              Export Accounts
            </Button>
            <Button variant="primary" size="md" iconLeading="add">
              Add Provider Account
            </Button>
          </>
        }
      />

      {/* Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-unit-md">
        <MetricCard title="Registered Emails" value="4" subtext="Owner addresses" icon="mail" />
        <MetricCard title="Provider Accounts" value="12" subtext="Across 6 providers" icon="cloud" />
        <MetricCard title="Linked Domains" value="42" subtext="100% attached" icon="language" />
        <MetricCard title="Linked Servers" value="6" subtext="100% mapped" icon="dns" />
      </div>

      {/* View Switcher & Search Bar */}
      <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col md:flex-row items-stretch md:items-center justify-between gap-unit-md">
        <div className="max-w-md w-full">
          <SearchInput placeholder="Search email, provider name or account ID..." />
        </div>
        <div className="flex items-center gap-unit-xs bg-surface-container-low p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('grouped')}
            className={`px-3 py-1.5 rounded-md font-label-md text-label-md font-medium transition-all ${
              viewMode === 'grouped'
                ? 'bg-surface-container-lowest text-on-surface shadow-micro font-semibold'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            Grouped by Email
          </button>
          <button
            type="button"
            onClick={() => setViewMode('flat')}
            className={`px-3 py-1.5 rounded-md font-label-md text-label-md font-medium transition-all ${
              viewMode === 'flat'
                ? 'bg-surface-container-lowest text-on-surface shadow-micro font-semibold'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            Flat Accounts Table
          </button>
        </div>
      </div>

      {/* Sample Grouped Email Block to Verify Deep Link to /accounts/:accountId */}
      <div className="p-unit-lg rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-unit-md">
        <div className="flex items-center justify-between pb-unit-sm border-b border-outline-variant/40">
          <div className="flex items-center gap-unit-sm">
            <div className="w-8 h-8 rounded-lg bg-primary-container/10 text-primary flex items-center justify-center font-mono font-bold text-[14px]">
              @
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-body-md font-bold text-on-surface">
                infra@worknai.com
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                DevOps &amp; Cloud Infrastructure Owner • 3 Provider Accounts
              </span>
            </div>
          </div>
          <span className="font-mono text-caption-xs text-primary font-semibold">
            ₹5,051 / mo
          </span>
        </div>

        {/* Child Account Card */}
        <div className="p-unit-md rounded-lg bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-unit-md">
          <div className="flex items-center gap-unit-sm">
            <div className="w-8 h-8 rounded bg-[#673DE6]/10 text-[#673DE6] flex items-center justify-center font-bold text-[12px] font-mono">
              HO
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-body-md font-semibold text-on-surface">
                WorknAi Hostinger Main
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary font-mono">
                Hostinger Cloud • 3 Servers, 9 Apps, 2 Domains
              </span>
            </div>
          </div>
          <Link to="/accounts/hostinger-worknai-main">
            <Button variant="secondary" size="sm" iconTrailing="arrow_forward">
              View Account Details
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
