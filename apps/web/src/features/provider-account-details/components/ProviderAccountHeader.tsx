import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ProviderAccountDetail } from '../providerAccountDetails.types';

interface ProviderAccountHeaderProps {
  account: ProviderAccountDetail;
  onEditClick: () => void;
  onExportClick: () => void;
}

export const ProviderAccountHeader: React.FC<ProviderAccountHeaderProps> = ({
  account,
  onEditClick,
  onExportClick,
}) => {
  const [refreshState, setRefreshState] = useState<'idle' | 'refreshing' | 'refreshed'>('idle');

  const handleRefresh = () => {
    if (refreshState !== 'idle') return;
    setRefreshState('refreshing');
    setTimeout(() => {
      setRefreshState('refreshed');
      setTimeout(() => {
        setRefreshState('idle');
      }, 2000);
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-unit-xs">
      {/* Top Breadcrumb & Internal Record Metadata */}
      <div className="flex items-center justify-between py-unit-sm flex-wrap gap-2">
        <div className="flex items-center gap-unit-xs text-caption-xs font-caption-xs">
          <Link to="/overview" className="text-secondary hover:text-primary transition-colors font-medium">
            DomainPulse
          </Link>
          <span className="text-secondary text-[11px]">/</span>
          <Link to="/accounts" className="text-secondary hover:text-primary transition-colors font-medium">
            Accounts &amp; Emails
          </Link>
          <span className="text-secondary text-[11px]">/</span>
          <span className="font-label-md text-label-md text-on-surface font-semibold">
            {account.providerCompany} ({account.accountName})
          </span>
        </div>
        <div className="flex items-center gap-unit-xs">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-mono text-label-mono">
            Internal Record ID: {account.accountId}
          </span>
        </div>
      </div>

      {/* Primary Page Header Block */}
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-sm border border-outline-variant/30">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-unit-md">
          <div className="flex items-start gap-unit-md">
            <div className="w-12 h-12 rounded-lg bg-[#673de6]/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#673de6] text-[26px]">dns</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center flex-wrap gap-unit-sm">
                <h1 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
                  {account.accountName}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-primary font-caption-xs text-caption-xs font-semibold uppercase">
                  {account.providerBadgeText}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-caption-xs text-caption-xs font-medium border border-emerald-200/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {account.mappingStatusLabel}
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-unit-md mt-unit-xs">
                <div className="flex items-center gap-1.5 font-label-mono text-label-mono text-primary font-medium bg-primary-fixed/40 px-2 py-0.5 rounded">
                  <span className="material-symbols-outlined text-[14px]">mail</span>
                  <span>{account.accountEmail}</span>
                </div>
                <span className="text-outline-variant text-[12px]">•</span>
                <span className="font-caption-xs text-caption-xs text-secondary">Account Type:</span>
                <span className="font-label-md text-label-md text-on-surface font-medium">{account.accountType}</span>
                <span className="text-outline-variant text-[12px]">•</span>
                <span className="font-caption-xs text-caption-xs text-secondary">Account Scope:</span>
                <span className="font-label-md text-label-md text-on-surface font-medium">{account.accountScope}</span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center flex-wrap gap-unit-xs shrink-0">
            <button
              onClick={onEditClick}
              className="h-9 px-unit-md flex items-center gap-1.5 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container font-label-md text-label-md transition-colors shadow-sm cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">label</span>
              <span>Edit Label</span>
            </button>
            <button
              onClick={onEditClick}
              className="h-9 px-unit-md flex items-center gap-1.5 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container font-label-md text-label-md transition-colors shadow-sm cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">tune</span>
              <span>Account Settings</span>
            </button>
            <button
              onClick={handleRefresh}
              className={`h-9 px-unit-md flex items-center gap-1.5 rounded-lg font-label-md text-label-md shadow-sm transition-colors cursor-pointer ${
                refreshState === 'refreshed'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-primary text-on-primary hover:bg-tertiary'
              }`}
              type="button"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  refreshState === 'refreshing' ? 'animate-spin' : ''
                }`}
              >
                {refreshState === 'refreshed' ? 'check' : 'refresh'}
              </span>
              <span>
                {refreshState === 'refreshing'
                  ? 'Refreshing...'
                  : refreshState === 'refreshed'
                  ? 'View Refreshed'
                  : 'Refresh View'}
              </span>
            </button>
            <button
              onClick={onExportClick}
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-colors shadow-sm cursor-pointer"
              title="Export Account Sheet"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
