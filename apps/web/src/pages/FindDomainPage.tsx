import React from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { SearchInput } from '@/components/common/SearchInput';

export const FindDomainPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-unit-lg">
      <PageHeader
        title="Find Domain"
        badge="Multi-TLD Search"
        description="Search domain keyword availability across 12+ top extensions, generate brandable names, and compare registrar prices."
      />

      {/* Domain Discovery Search Hero */}
      <div className="p-unit-lg rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-unit-md">
        <div className="flex flex-col md:flex-row items-stretch gap-unit-sm">
          <div className="flex-1">
            <SearchInput
              placeholder="Search keyword or domain name (e.g., worknai, finpilot, cloudflow)..."
              showShortcut={false}
            />
          </div>
          <Button variant="primary" size="md" iconLeading="search">
            Search Extensions
          </Button>
        </div>

        {/* TLD Selection Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-caption-xs font-caption-xs pt-unit-xs">
          <span className="text-secondary font-medium mr-1">Active TLDs:</span>
          {['.com', '.in', '.co.in', '.ai', '.io', '.co', '.dev', '.app', '.tech', '.net', '.org'].map(
            (tld) => (
              <span
                key={tld}
                className="px-2 py-0.5 rounded bg-surface-container font-mono text-[11px] font-semibold text-on-surface"
              >
                {tld}
              </span>
            )
          )}
        </div>
      </div>

      {/* Results Workspace Placeholder */}
      <div className="p-unit-xl rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary mb-unit-sm">
          <span className="material-symbols-outlined text-[28px]">travel_explore</span>
        </div>
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
          Domain Discovery &amp; Synthesizer
        </h3>
        <p className="font-body-sm text-body-sm text-secondary max-w-md mt-unit-xs">
          Search across multiple top-level domain extensions, inspect registration availability, and discover alternative brandable name variations.
        </p>
      </div>
    </div>
  );
};
