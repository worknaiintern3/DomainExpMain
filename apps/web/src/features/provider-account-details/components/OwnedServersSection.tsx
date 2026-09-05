import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { OwnedServerRecord } from '../providerAccountDetails.types';

interface OwnedServersSectionProps {
  servers: OwnedServerRecord[];
}

export const OwnedServersSection: React.FC<OwnedServersSectionProps> = ({ servers }) => {
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const handleCopyIp = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => {
      setCopiedIp(null);
    }, 1500);
  };

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 overflow-hidden">
      {/* Section Header */}
      <div className="p-unit-md flex items-center justify-between flex-wrap gap-2 border-b border-surface-container/50">
        <div className="flex items-center gap-unit-xs">
          <span className="material-symbols-outlined text-primary text-[20px]">dns</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Owned Servers</h2>
          <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-caption-xs text-caption-xs font-semibold">
            {servers.length} Mapped
          </span>
        </div>
        <div className="flex items-center gap-unit-xs">
          <span className="font-caption-xs text-caption-xs text-secondary">Data Source:</span>
          <span className="font-caption-xs text-caption-xs text-on-surface font-medium">
            User Mapped / Inventory Records
          </span>
        </div>
      </div>

      {/* Table Container */}
      {servers.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low text-secondary font-caption-xs text-caption-xs uppercase tracking-wider">
                <th className="py-2.5 px-unit-md font-semibold">Server Name</th>
                <th className="py-2.5 px-unit-sm font-semibold">Public IP</th>
                <th className="py-2.5 px-unit-sm font-semibold">Hardware Sizing</th>
                <th className="py-2.5 px-unit-sm font-semibold text-center">Websites</th>
                <th className="py-2.5 px-unit-sm font-semibold text-right">Cost</th>
                <th className="py-2.5 px-unit-sm font-semibold">Renewal Due</th>
                <th className="py-2.5 px-unit-md font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-body-sm">
              {servers.map((srv) => (
                <tr key={srv.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="py-unit-sm px-unit-md">
                    <div className="flex items-center gap-unit-xs">
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                      <div className="flex flex-col min-w-0">
                        <Link
                          to={`/servers/${srv.id}`}
                          className="font-label-md text-label-md font-semibold text-on-surface hover:text-primary transition-colors truncate"
                        >
                          {srv.name}
                        </Link>
                        <span className="font-caption-xs text-caption-xs text-secondary truncate">
                          {srv.osPlatform}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-unit-sm px-unit-sm font-label-mono text-label-mono text-on-surface">
                    <button
                      type="button"
                      onClick={() => handleCopyIp(srv.ipAddress)}
                      className="flex items-center gap-1 group text-left cursor-pointer hover:text-primary transition-colors"
                      title="Copy IP Address"
                    >
                      <span>{srv.ipAddress}</span>
                      <span className="material-symbols-outlined text-[14px] text-secondary group-hover:text-primary">
                        {copiedIp === srv.ipAddress ? 'check' : 'content_copy'}
                      </span>
                    </button>
                  </td>
                  <td className="py-unit-sm px-unit-sm">
                    <span className="font-label-mono text-label-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                      {srv.hardwareSizing}
                    </span>
                  </td>
                  <td className="py-unit-sm px-unit-sm text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container text-on-surface font-caption-xs text-caption-xs font-semibold">
                      {srv.websitesCount} {srv.websitesCount === 1 ? 'App' : 'Apps'}
                    </span>
                  </td>
                  <td className="py-unit-sm px-unit-sm text-right font-label-mono text-label-mono font-semibold text-on-surface">
                    {srv.monthlyCostFormatted}
                    <span className="text-secondary text-[10px] font-normal">/mo</span>
                  </td>
                  <td className="py-unit-sm px-unit-sm font-label-mono text-label-mono text-on-surface-variant">
                    {srv.renewalDate}
                  </td>
                  <td className="py-unit-sm px-unit-md text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-caption-xs text-caption-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                      {srv.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-unit-lg text-center text-secondary text-body-sm">
          No dedicated compute servers mapped to this registrar/DNS provider account.
        </div>
      )}

      {/* Footer bar */}
      <div className="p-unit-sm px-unit-md bg-surface-container-low flex items-center justify-between text-caption-xs font-caption-xs text-secondary border-t border-surface-container/50">
        <span>Displaying {servers.length} of {servers.length} mapped compute units</span>
        <Link to="/servers" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
          <span>Manage VPS Settings in Servers Tab</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
};
