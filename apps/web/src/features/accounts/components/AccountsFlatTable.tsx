import React from 'react';
import { ProviderAccount } from '../accounts.types';

interface AccountsFlatTableProps {
  accounts: ProviderAccount[];
  onInspect: (account: ProviderAccount) => void;
}

export const AccountsFlatTable: React.FC<AccountsFlatTableProps> = ({ accounts, onInspect }) => {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/30">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low h-9 text-secondary font-caption-xs text-caption-xs uppercase tracking-wider select-none border-b border-outline-variant/30">
              <th className="px-unit-md font-semibold">Provider / Account Name</th>
              <th className="px-unit-md font-semibold">Account Identifier</th>
              <th className="px-unit-md font-semibold">Associated Email</th>
              <th className="px-unit-md font-semibold text-center">Domains</th>
              <th className="px-unit-md font-semibold text-center">Servers</th>
              <th className="px-unit-md font-semibold text-center">Websites</th>
              <th className="px-unit-md font-semibold">Mapping Status</th>
              <th className="px-unit-md font-semibold">Estimated Cost</th>
              <th className="px-unit-md font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container font-body-sm text-body-sm text-on-surface">
            {accounts.map((acc) => (
              <tr
                key={acc.id}
                onClick={() => onInspect(acc)}
                className="hover:bg-surface-container-low/50 transition-colors h-11 cursor-pointer group"
              >
                {/* Provider / Account */}
                <td className="px-unit-md py-unit-xs">
                  <div className="flex items-center gap-unit-xs">
                    <span
                      className={`w-6 h-6 rounded ${acc.logoBgColor} ${acc.logoTextColor} text-[10px] flex items-center justify-center font-label-mono font-bold shrink-0 border border-outline-variant/20`}
                    >
                      {acc.logoLetter}
                    </span>
                    <span className="font-medium text-on-surface group-hover:text-primary transition-colors truncate">
                      {acc.providerCompany} - {acc.accountName}
                    </span>
                  </div>
                </td>

                {/* Account Identifier */}
                <td className="px-unit-md font-label-mono text-caption-xs text-secondary">
                  {acc.accountId}
                </td>

                {/* Associated Email */}
                <td className="px-unit-md font-label-mono text-caption-xs text-primary font-medium">
                  {acc.accountEmail}
                </td>

                {/* Counts */}
                <td className="px-unit-md text-center font-semibold">{acc.domainsCount}</td>
                <td className="px-unit-md text-center text-secondary">
                  {acc.workersCount !== undefined ? `${acc.workersCount} (W)` : acc.serversCount}
                </td>
                <td className="px-unit-md text-center font-medium">{acc.websitesCount}</td>

                {/* Mapping Status */}
                <td className="px-unit-md">
                  <span
                    className={`inline-flex items-center gap-1 px-unit-xs py-unit-2xs rounded-full font-caption-xs text-caption-xs font-medium border ${
                      acc.mappingStatus === 'mapped'
                        ? 'bg-surface-container text-on-surface-variant border-outline-variant/30'
                        : acc.mappingStatus === 'expiring'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-surface-container-high text-secondary border-outline-variant/20'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        acc.mappingStatus === 'mapped'
                          ? 'bg-primary'
                          : acc.mappingStatus === 'expiring'
                          ? 'bg-amber-500'
                          : 'bg-secondary'
                      }`}
                    />
                    {acc.mappingStatusLabel}
                  </span>
                </td>

                {/* Estimated Cost / Billing Model */}
                <td className="px-unit-md font-label-mono text-caption-xs text-secondary">
                  {acc.estimatedCostMonthly || 'Billing Model: Pay-as-you-go'}
                </td>

                {/* Actions */}
                <td className="px-unit-md text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onInspect(acc)}
                    className="text-primary hover:text-tertiary font-label-md text-label-md hover:underline cursor-pointer"
                    type="button"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
