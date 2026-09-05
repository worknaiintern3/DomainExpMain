import React from 'react';
import { EmailGroup, ProviderAccount } from '../accounts.types';
import { ProviderAccountCard } from './ProviderAccountCard';

interface EmailGroupCardProps {
  group: EmailGroup;
  onInspectAccount: (account: ProviderAccount) => void;
  onManageGroup: (group: EmailGroup) => void;
}

export const EmailGroupCard: React.FC<EmailGroupCardProps> = ({
  group,
  onInspectAccount,
  onManageGroup,
}) => {
  const mappedRelationshipsCount = group.providerAccounts.reduce(
    (sum, p) => sum + p.domainsCount + p.serversCount + p.websitesCount + (p.workersCount || 0),
    0
  );

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/30">
      {/* Email Header Bar */}
      <div className="bg-surface-container-low px-unit-lg py-unit-md flex flex-wrap items-center justify-between gap-unit-sm border-b border-outline-variant/20">
        <div className="flex items-center gap-unit-md min-w-0">
          <div
            className={`w-10 h-10 rounded-lg ${group.iconBgColor} ${group.iconTextColor} flex items-center justify-center shrink-0 font-label-mono font-semibold border border-outline-variant/20`}
          >
            {group.iconIsMaterial ? (
              <span className="material-symbols-outlined text-[20px]">{group.icon}</span>
            ) : (
              <span>{group.icon}</span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-unit-sm flex-wrap">
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold font-label-mono truncate">
                {group.email}
              </span>
              <span className="inline-flex items-center gap-1 px-unit-xs py-unit-2xs rounded-full bg-surface-container text-on-surface-variant font-caption-xs text-caption-xs font-medium border border-outline-variant/20">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {group.providerAccounts.length} Provider Accounts • {mappedRelationshipsCount} Mapped Relationships
                {group.estimatedCostMonthly ? ` • ${group.estimatedCostMonthly}` : ''}
              </span>
            </div>
            <span className="font-caption-xs text-caption-xs text-secondary mt-0.5 truncate">
              {group.subtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-unit-sm">
          <button
            onClick={() => onManageGroup(group)}
            className="h-8 px-unit-sm rounded bg-surface hover:bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-unit-xs transition-colors border border-outline-variant/20"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">
              manage_accounts
            </span>
            <span>Manage Accounts</span>
          </button>
          <button
            onClick={() => onManageGroup(group)}
            className="h-8 px-unit-sm rounded bg-primary-container text-on-primary font-label-md text-label-md flex items-center gap-unit-xs transition-colors shadow-sm"
            type="button"
          >
            <span>View Assets ({mappedRelationshipsCount})</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Provider Accounts Sibling Cards Grid */}
      <div className="p-unit-lg">
        <div
          className={`grid gap-unit-md ${
            group.providerAccounts.length >= 3
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 md:grid-cols-2'
          }`}
        >
          {group.providerAccounts.map((account) => (
            <ProviderAccountCard
              key={account.id}
              account={account}
              onInspect={onInspectAccount}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
