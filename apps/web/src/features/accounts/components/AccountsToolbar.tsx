import React from 'react';
import { AccountsFilterState } from '../accounts.types';

interface AccountsToolbarProps {
  filterState: AccountsFilterState;
  onFilterChange: (key: keyof AccountsFilterState, value: string) => void;
  providerCount: number;
  emailGroupCount: number;
}

export const AccountsToolbar: React.FC<AccountsToolbarProps> = ({
  filterState,
  onFilterChange,
  providerCount,
  emailGroupCount,
}) => {
  return (
    <div className="bg-surface-container-lowest p-unit-sm rounded-xl shadow-sm flex flex-col lg:flex-row gap-unit-sm lg:items-center justify-between border border-outline-variant/30">
      {/* Search and Filters */}
      <div className="flex flex-1 items-center gap-unit-sm flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md flex items-center">
          <span className="material-symbols-outlined absolute left-unit-sm text-on-surface-variant text-[18px] pointer-events-none">
            search
          </span>
          <input
            value={filterState.searchQuery}
            onChange={(e) => onFilterChange('searchQuery', e.target.value)}
            className="w-full h-9 pl-9 pr-unit-md rounded-lg bg-surface text-on-surface font-body-sm text-body-sm shadow-sm placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
            placeholder="Search email, provider, account or asset..."
            type="text"
          />
        </div>

        <div className="flex items-center gap-unit-2xs flex-wrap">
          <select
            value={filterState.provider}
            onChange={(e) => onFilterChange('provider', e.target.value)}
            className="h-9 px-unit-sm rounded-lg bg-surface text-on-surface-variant font-label-md text-label-md hover:bg-surface-container cursor-pointer border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Provider: All</option>
            <option value="GoDaddy">GoDaddy</option>
            <option value="Namecheap">Namecheap</option>
            <option value="Hostinger">Hostinger</option>
            <option value="DigitalOcean">DigitalOcean</option>
            <option value="Hetzner Cloud">Hetzner Cloud</option>
            <option value="Vultr">Vultr</option>
            <option value="Cloudflare">Cloudflare</option>
            <option value="Amazon Web Services">AWS</option>
            <option value="Google Cloud Platform">GCP</option>
          </select>

          <select
            value={filterState.assetType}
            onChange={(e) => onFilterChange('assetType', e.target.value)}
            className="h-9 px-unit-sm rounded-lg bg-surface text-on-surface-variant font-label-md text-label-md hover:bg-surface-container cursor-pointer border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Asset Type: All</option>
            <option value="domains">With Domains</option>
            <option value="servers">With Servers</option>
            <option value="websites">With Websites</option>
          </select>

          <select
            value={filterState.project}
            onChange={(e) => onFilterChange('project', e.target.value)}
            className="h-9 px-unit-sm rounded-lg bg-surface text-on-surface-variant font-label-md text-label-md hover:bg-surface-container cursor-pointer border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Project: All</option>
            <option value="WorknAi">WorknAi</option>
            <option value="AI BOS">AI BOS</option>
            <option value="WorknAi Dev">WorknAi Dev</option>
            <option value="Legacy">Legacy</option>
          </select>
        </div>
      </div>

      {/* Switcher & Count */}
      <div className="flex items-center justify-between lg:justify-end gap-unit-sm flex-wrap">
        <div className="flex items-center bg-surface p-unit-2xs rounded-lg border border-outline-variant/20">
          <button
            onClick={() => onFilterChange('viewMode', 'grouped')}
            className={`px-unit-sm py-unit-2xs rounded-md font-label-md text-label-md transition-all flex items-center gap-unit-xs ${
              filterState.viewMode === 'grouped'
                ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-sm'
                : 'text-secondary hover:text-on-surface'
            }`}
            type="button"
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                filterState.viewMode === 'grouped' ? 'text-primary' : 'text-secondary'
              }`}
            >
              workspaces
            </span>
            <span>Grouped by Email</span>
          </button>
          <button
            onClick={() => onFilterChange('viewMode', 'flat')}
            className={`px-unit-sm py-unit-2xs rounded-md font-label-md text-label-md transition-all flex items-center gap-unit-xs ${
              filterState.viewMode === 'flat'
                ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-sm'
                : 'text-secondary hover:text-on-surface'
            }`}
            type="button"
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                filterState.viewMode === 'flat' ? 'text-primary' : 'text-secondary'
              }`}
            >
              table_rows
            </span>
            <span>Flat Accounts Table</span>
          </button>
        </div>

        <span className="text-secondary font-caption-xs text-caption-xs font-mono hidden sm:inline">
          {filterState.viewMode === 'grouped'
            ? `Showing ${emailGroupCount} email groups`
            : `Showing ${providerCount} provider accounts`}
        </span>
      </div>
    </div>
  );
};
