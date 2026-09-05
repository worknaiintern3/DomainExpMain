import React from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SearchInput } from '@/components/common/SearchInput';
import { Link } from 'react-router-dom';

export const WebsitesPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-unit-lg">
      <PageHeader
        title="Websites &amp; Apps"
        badge="18 Applications"
        description="Track deployed web applications, primary domain bindings, runtime ports, host servers, and SSL certificate validity."
        actions={
          <>
            <Button variant="secondary" size="md" iconLeading="file_download">
              Export Apps
            </Button>
            <Button variant="primary" size="md" iconLeading="add">
              Add Website / App
            </Button>
          </>
        }
      />

      {/* Filter toolbar */}
      <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col md:flex-row items-stretch md:items-center justify-between gap-unit-md">
        <div className="max-w-md w-full">
          <SearchInput placeholder="Search website name, domain, tech stack or server..." />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap text-caption-xs font-caption-xs">
          <span className="px-2.5 py-1 rounded-full bg-primary-container text-white font-semibold">
            All (18)
          </span>
          <span className="px-2.5 py-1 rounded-full bg-surface-container text-secondary font-medium hover:bg-surface-container-high transition-colors cursor-pointer">
            Production (12)
          </span>
          <span className="px-2.5 py-1 rounded-full bg-surface-container text-secondary font-medium hover:bg-surface-container-high transition-colors cursor-pointer">
            Staging (4)
          </span>
        </div>
      </div>

      {/* Sample Row Card to Verify Deep Link to /websites/:websiteId */}
      <div className="p-unit-lg rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-unit-md">
        <div className="p-unit-md rounded-lg bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-unit-md">
          <div className="flex items-center gap-unit-sm">
            <div className="w-9 h-9 rounded-lg bg-primary-fixed text-primary flex items-center justify-center font-bold text-[13px]">
              W
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-body-md font-semibold text-on-surface">
                WorknAi Website
              </span>
              <span className="font-mono text-caption-xs text-secondary">
                worknai.com • Port :3000 • Production VPS 01 (Hostinger)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-unit-sm">
            <StatusBadge status="healthy" label="SSL Valid • 68d" />
            <Link to="/websites/worknai-website">
              <Button variant="secondary" size="sm" iconTrailing="arrow_forward">
                App Details
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
