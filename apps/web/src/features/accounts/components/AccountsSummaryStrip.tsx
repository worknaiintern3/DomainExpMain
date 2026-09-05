import React from 'react';
import { AccountsSummary } from '../accounts.types';

interface AccountsSummaryStripProps {
  summary: AccountsSummary;
}

export const AccountsSummaryStrip: React.FC<AccountsSummaryStripProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-unit-sm">
      {/* 1. Managed Emails */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/30">
        <div className="flex items-center justify-between text-secondary">
          <span className="font-caption-xs text-caption-xs uppercase font-semibold tracking-wider">
            Managed Emails
          </span>
          <span className="material-symbols-outlined text-[18px]">alternate_email</span>
        </div>
        <div className="mt-unit-sm flex items-baseline justify-between">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold">
            {summary.managedEmailsCount}
          </span>
          <span className="font-caption-xs text-caption-xs bg-surface-container px-unit-xs py-unit-2xs rounded font-medium text-on-secondary-container">
            {summary.managedEmailsSubtext}
          </span>
        </div>
      </div>

      {/* 2. Provider Accounts */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/30">
        <div className="flex items-center justify-between text-secondary">
          <span className="font-caption-xs text-caption-xs uppercase font-semibold tracking-wider">
            Provider Accounts
          </span>
          <span className="material-symbols-outlined text-[18px]">hub</span>
        </div>
        <div className="mt-unit-sm flex items-baseline justify-between">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold">
            {summary.providerAccountsCount}
          </span>
          <span className="font-caption-xs text-caption-xs bg-surface-container px-unit-xs py-unit-2xs rounded font-medium text-on-secondary-container">
            {summary.providerAccountsSubtext}
          </span>
        </div>
      </div>

      {/* 3. Domains Linked */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/30">
        <div className="flex items-center justify-between text-secondary">
          <span className="font-caption-xs text-caption-xs uppercase font-semibold tracking-wider">
            Domains Linked
          </span>
          <span className="material-symbols-outlined text-[18px]">domain</span>
        </div>
        <div className="mt-unit-sm flex items-baseline justify-between">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold">
            {summary.domainsLinkedCount}
          </span>
          <span className="font-caption-xs text-caption-xs text-primary font-medium flex items-center">
            <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
            <span>{summary.domainsLinkedSubtext}</span>
          </span>
        </div>
      </div>

      {/* 4. Servers Linked */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/30">
        <div className="flex items-center justify-between text-secondary">
          <span className="font-caption-xs text-caption-xs uppercase font-semibold tracking-wider">
            Servers Linked
          </span>
          <span className="material-symbols-outlined text-[18px]">dns</span>
        </div>
        <div className="mt-unit-sm flex items-baseline justify-between">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold">
            {summary.serversLinkedCount}
          </span>
          <span className="font-caption-xs text-caption-xs bg-surface-container px-unit-xs py-unit-2xs rounded font-medium text-on-secondary-container">
            {summary.serversLinkedSubtext}
          </span>
        </div>
      </div>

      {/* 5. Unmapped Assets */}
      <div className="col-span-2 md:col-span-1 bg-surface-container-lowest p-unit-md rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/30">
        <div className="flex items-center justify-between text-secondary">
          <span className="font-caption-xs text-caption-xs uppercase font-semibold tracking-wider">
            Unmapped Assets
          </span>
          <span className="material-symbols-outlined text-[18px] text-amber-500">warning</span>
        </div>
        <div className="mt-unit-sm flex items-baseline justify-between">
          <span className="font-headline-md text-headline-md text-on-surface font-semibold">
            {summary.unmappedAssetsCount}
          </span>
          <span className="inline-flex items-center gap-1 px-unit-xs py-unit-2xs rounded-full bg-amber-50 text-amber-800 font-caption-xs text-caption-xs font-medium border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>{summary.unmappedAssetsSubtext}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
