import React from 'react';
import { Link } from 'react-router-dom';
import { HostedAppRecord } from '../serverDetails.types';

interface HostedApplicationsSectionProps {
  apps: HostedAppRecord[];
}

export const HostedApplicationsSection: React.FC<HostedApplicationsSectionProps> = ({ apps }) => {
  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sm flex flex-col border border-outline-variant/30">
      {/* Card Header */}
      <div className="p-unit-md flex items-center justify-between bg-surface-container-low rounded-t-xl border-b border-outline-variant/30">
        <div className="flex items-center gap-unit-sm">
          <span className="material-symbols-outlined text-primary text-[20px]">apps</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Hosted Websites &amp; Applications
          </h2>
        </div>
        <span className="px-unit-sm py-unit-2xs rounded bg-surface-container-high text-primary font-caption-xs text-caption-xs font-semibold border border-primary/20">
          {apps.length} Mapped Services
        </span>
      </div>

      {/* Applications Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container text-secondary font-caption-xs text-caption-xs uppercase tracking-wider select-none border-b border-outline-variant/30">
              <th className="p-unit-sm font-semibold">Domain / Service</th>
              <th className="p-unit-sm font-semibold">Runtime / Stack</th>
              <th className="p-unit-sm font-semibold">Port &amp; Proxy</th>
              <th className="p-unit-sm font-semibold">SSL Status</th>
              <th className="p-unit-sm text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm text-on-surface">
            {apps.map((app) => (
              <tr
                key={app.id}
                className="hover:bg-surface-container-low transition-colors"
              >
                {/* Domain & Service Name */}
                <td className="p-unit-sm">
                  <div className="flex flex-col min-w-0">
                    <Link
                      to={`/domains/${app.domain}`}
                      className="font-label-mono text-label-mono font-semibold text-primary hover:underline truncate"
                    >
                      {app.domain}
                    </Link>
                    <span className="font-caption-xs text-caption-xs text-secondary truncate">
                      {app.name}
                    </span>
                  </div>
                </td>

                {/* Runtime / Stack */}
                <td className="p-unit-sm">
                  <span className="inline-block px-unit-xs py-unit-2xs rounded bg-surface-container-high text-on-surface font-caption-xs text-caption-xs font-medium border border-outline-variant/20 whitespace-nowrap">
                    {app.runtime}
                  </span>
                </td>

                {/* Port & Reverse Proxy */}
                <td className="p-unit-sm font-label-mono text-caption-xs">
                  <div className="text-on-surface font-semibold">Port: {app.port}</div>
                  <div className="text-secondary font-sans text-caption-xs">
                    Reverse: {app.reverseProxy}
                  </div>
                </td>

                {/* SSL Status */}
                <td className="p-unit-sm">
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-unit-xs py-0.5 rounded text-caption-xs font-semibold border border-emerald-200">
                      <span className="material-symbols-outlined text-[13px]">lock</span>
                      <span>{app.sslStatusText}</span>
                    </span>
                  </div>
                </td>

                {/* Mapping Status */}
                <td className="p-unit-sm text-right">
                  <span className="inline-flex items-center gap-1 px-unit-sm py-[2px] rounded-full bg-surface-container-high text-primary font-caption-xs text-caption-xs font-medium border border-outline-variant/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span>{app.status}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
