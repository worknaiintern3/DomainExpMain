import React from 'react';
import { ProviderAccount } from '../accounts.types';

interface ProviderAccountCardProps {
  account: ProviderAccount;
  onInspect: (account: ProviderAccount) => void;
}

export const ProviderAccountCard: React.FC<ProviderAccountCardProps> = ({ account, onInspect }) => {
  return (
    <div className="bg-surface rounded-xl p-unit-md flex flex-col justify-between shadow-sm border border-outline-variant/30 hover:border-primary/40 transition-all">
      <div className="flex flex-col gap-unit-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-unit-xs">
          <div className="flex items-center gap-unit-sm min-w-0">
            <div
              className={`w-8 h-8 rounded ${account.logoBgColor} ${account.logoTextColor} flex items-center justify-center font-bold text-[12px] font-label-mono shrink-0 border border-outline-variant/20`}
            >
              {account.logoLetter}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-unit-xs flex-wrap">
                <span className="font-label-md text-label-md font-semibold text-on-surface truncate">
                  {account.providerCompany}
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary font-label-mono">
                  (Account: {account.accountId})
                </span>
              </div>
              <span className="font-caption-xs text-caption-xs text-secondary truncate">
                {account.accountName}
              </span>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 px-unit-xs py-unit-2xs rounded-full font-caption-xs text-caption-xs font-medium shrink-0 border ${
              account.mappingStatus === 'mapped'
                ? 'bg-surface-container text-on-surface-variant border-outline-variant/30'
                : account.mappingStatus === 'expiring'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-surface-container-high text-secondary border-outline-variant/20'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                account.mappingStatus === 'mapped'
                  ? 'bg-primary'
                  : account.mappingStatus === 'expiring'
                  ? 'bg-amber-500'
                  : 'bg-secondary'
              }`}
            />
            {account.mappingStatusLabel}
          </span>
        </div>

        {/* 3 Metrics Strip */}
        <div className="grid grid-cols-3 gap-unit-xs pt-unit-xs">
          <div className="bg-surface-container-lowest p-unit-xs rounded text-center border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary block">
              {account.workersCount !== undefined ? 'Domains DNS' : 'Domains'}
            </span>
            <span
              className={`font-headline-sm text-headline-sm font-semibold ${
                account.domainsCount > 0 ? 'text-primary' : 'text-secondary'
              }`}
            >
              {account.domainsCount}
            </span>
          </div>
          <div className="bg-surface-container-lowest p-unit-xs rounded text-center border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary block">
              {account.workersCount !== undefined ? 'Workers' : 'Servers'}
            </span>
            <span
              className={`font-headline-sm text-headline-sm font-semibold ${
                (account.workersCount || account.serversCount) > 0
                  ? 'text-on-surface'
                  : 'text-secondary'
              }`}
            >
              {account.workersCount !== undefined ? account.workersCount : account.serversCount}
            </span>
          </div>
          <div className="bg-surface-container-lowest p-unit-xs rounded text-center border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary block">Websites</span>
            <span
              className={`font-headline-sm text-headline-sm font-semibold ${
                account.websitesCount > 0 ? 'text-on-surface' : 'text-secondary'
              }`}
            >
              {account.websitesCount}
            </span>
          </div>
        </div>

        {/* Sample Attached Assets */}
        {account.sampleAssets.length > 0 && (
          <div className="pt-unit-xs flex flex-col gap-unit-2xs">
            <span className="font-caption-xs text-caption-xs uppercase font-semibold text-secondary tracking-wider">
              Sample Attached Assets
            </span>
            <div className="flex flex-wrap gap-unit-2xs font-label-mono text-label-mono">
              {account.sampleAssets.map((asset) => (
                <span
                  key={asset}
                  className="px-unit-xs py-unit-2xs rounded bg-surface-container-lowest text-on-surface text-caption-xs border border-outline-variant/20 truncate"
                >
                  {asset}
                </span>
              ))}
              {account.moreAssetsCount && account.moreAssetsCount > 0 && (
                <span className="px-unit-xs py-unit-2xs rounded bg-surface-container text-secondary text-caption-xs font-sans">
                  +{account.moreAssetsCount} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-unit-md mt-unit-sm flex items-center justify-between border-t border-outline-variant/20">
        <span className="font-caption-xs text-caption-xs text-secondary font-mono truncate">
          {account.autoRenewalText || account.estimatedCostMonthly || 'User Mapped'}
        </span>
        <button
          onClick={() => onInspect(account)}
          className="font-label-md text-label-md text-primary hover:underline flex items-center gap-unit-2xs shrink-0 cursor-pointer"
          type="button"
        >
          <span>View Details</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};
