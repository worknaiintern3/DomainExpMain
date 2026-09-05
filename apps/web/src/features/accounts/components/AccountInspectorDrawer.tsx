import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ProviderAccount } from '../accounts.types';

interface AccountInspectorDrawerProps {
  account: ProviderAccount | null;
  onClose: () => void;
  onEdit: (account: ProviderAccount) => void;
}

export const AccountInspectorDrawer: React.FC<AccountInspectorDrawerProps> = ({
  account,
  onClose,
  onEdit,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  if (!account) return null;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(account.accountEmail).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-surface-container-lowest shadow-2xl p-unit-lg flex flex-col gap-unit-md border-l border-outline-variant/40 z-10 animate-in slide-in-from-right duration-150 h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex items-center gap-unit-sm min-w-0">
            <div
              className={`w-9 h-9 rounded-lg ${account.logoBgColor} ${account.logoTextColor} flex items-center justify-center font-bold text-[13px] font-label-mono shrink-0 border border-outline-variant/20`}
            >
              {account.logoLetter}
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                {account.providerCompany}
              </h3>
              <span className="font-caption-xs text-caption-xs text-secondary truncate">
                {account.accountName}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-secondary hover:text-on-surface p-1 rounded hover:bg-surface-container transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Account ID & Email Tile */}
        <div className="bg-surface-container-low p-unit-md rounded-lg flex flex-col gap-unit-xs border border-outline-variant/20">
          <div className="flex items-center justify-between">
            <span className="font-caption-xs text-caption-xs uppercase font-semibold text-secondary">
              Account Identifier
            </span>
            <span className="font-label-mono text-caption-xs font-bold text-on-surface">
              {account.accountId}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-surface-container">
            <span className="font-caption-xs text-caption-xs uppercase font-semibold text-secondary">
              Registered Email
            </span>
            <div className="flex items-center gap-1">
              <span className="font-label-mono text-caption-xs font-semibold text-primary truncate">
                {account.accountEmail}
              </span>
              <button
                onClick={handleCopyEmail}
                className="text-secondary hover:text-primary transition-colors p-0.5 rounded"
                title="Copy Email"
                type="button"
              >
                <span className={`material-symbols-outlined text-[14px] ${isCopied ? 'text-emerald-600' : ''}`}>
                  {isCopied ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Asset Counts Matrix */}
        <div className="grid grid-cols-3 gap-unit-xs">
          <div className="bg-surface-container-low p-unit-sm rounded text-center border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary block">Domains</span>
            <span className="font-headline-sm text-headline-sm text-primary font-bold">
              {account.domainsCount}
            </span>
          </div>
          <div className="bg-surface-container-low p-unit-sm rounded text-center border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary block">Servers</span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
              {account.workersCount !== undefined ? account.workersCount : account.serversCount}
            </span>
          </div>
          <div className="bg-surface-container-low p-unit-sm rounded text-center border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary block">Websites</span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
              {account.websitesCount}
            </span>
          </div>
        </div>

        {/* Sample Assets List */}
        <div className="flex flex-col gap-unit-xs">
          <span className="font-caption-xs text-caption-xs uppercase font-semibold text-secondary tracking-wider">
            Connected Infrastructure Assets
          </span>
          <div className="flex flex-col gap-1">
            {account.sampleAssets.map((asset) => (
              <div
                key={asset}
                className="p-unit-xs px-unit-sm rounded bg-surface-container-low flex items-center justify-between text-body-sm font-label-mono text-[12px] border border-outline-variant/20"
              >
                <span className="text-on-surface truncate">{asset}</span>
                <span className="text-secondary font-caption-xs text-[10px]">User Mapped</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cost & Mapping Info */}
        <div className="p-unit-sm rounded-lg bg-surface-container-low flex flex-col gap-1 border border-outline-variant/20">
          <div className="flex items-center justify-between text-caption-xs">
            <span className="text-secondary font-medium">Estimated Spend / Model</span>
            <span className="font-label-mono font-bold text-on-surface">
              {account.estimatedCostMonthly || 'Billing Model: Pay-as-you-go'}
            </span>
          </div>
          {account.autoRenewalText && (
            <div className="flex items-center justify-between text-caption-xs mt-1 pt-1 border-t border-surface-container">
              <span className="text-secondary font-medium">Auto-Renewal</span>
              <span className="font-label-mono text-primary font-medium">
                {account.autoRenewalText}
              </span>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="pt-unit-sm mt-auto flex flex-col gap-unit-xs">
          <Link
            to={`/accounts/${account.id}`}
            className="w-full h-9 flex items-center justify-center gap-unit-xs rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm transition-colors"
          >
            <span>View Account Details</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
          <div className="flex items-center gap-unit-xs">
            <button
              onClick={() => onEdit(account)}
              className="flex-1 h-8 flex items-center justify-center gap-unit-xs rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors border border-outline-variant/30"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">edit</span>
              <span>Edit Mappings</span>
            </button>
            <button
              onClick={onClose}
              className="h-8 px-unit-md flex items-center justify-center rounded-lg bg-surface-container-low hover:bg-surface-container text-secondary font-label-md text-label-md transition-colors border border-outline-variant/30"
              type="button"
            >
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
