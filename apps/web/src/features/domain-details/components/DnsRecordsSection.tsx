import React from 'react';
import { DomainDetailData } from '../domainDetails.types';

interface DnsRecordsSectionProps {
  data: DomainDetailData;
  onOpenZoneFile: () => void;
}

export const DnsRecordsSection: React.FC<DnsRecordsSectionProps> = ({
  data,
  onOpenZoneFile,
}) => {
  return (
    <div id="dns-section" className="bg-surface-container-lowest rounded-xl p-unit-lg shadow-sm border border-outline-variant/30">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-unit-sm mb-unit-md bg-surface-container-low/40 p-unit-sm rounded-lg border border-outline-variant/20">
        <div className="flex items-center gap-unit-xs">
          <span className="material-symbols-outlined text-primary text-[20px]">dns</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            DNS &amp; Nameserver Infrastructure
          </h2>
        </div>
        <span className="px-unit-sm py-unit-2xs rounded bg-surface-container text-primary font-caption-xs text-caption-xs font-semibold border border-outline-variant/20">
          DNS Retrieved • {data.dnsProvider}
        </span>
      </div>

      {/* 2-Column Nameserver & DNSSEC Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md mb-unit-md">
        {/* Nameservers */}
        <div className="bg-surface-container-low p-unit-md rounded-lg border border-outline-variant/20">
          <div className="flex items-center justify-between mb-unit-xs">
            <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
              Active Nameservers
            </span>
            <span className="text-[10px] text-primary font-medium bg-surface-container px-1.5 py-0.5 rounded border border-outline-variant/20">
              DNS Retrieved
            </span>
          </div>
          <div className="flex flex-col gap-1.5 font-label-mono text-label-mono text-on-surface text-[12px]">
            {data.nameservers.map((ns) => (
              <div
                key={ns.host}
                className="flex items-center justify-between p-unit-xs bg-surface-container-lowest rounded shadow-xs border border-outline-variant/20"
              >
                <span className="font-semibold text-primary">{ns.host}</span>
                <span className="text-[10px] text-secondary">{ns.tier}</span>
              </div>
            ))}
          </div>
        </div>

        {/* DNSSEC Configuration */}
        <div className="bg-surface-container-low p-unit-md rounded-lg flex flex-col justify-between border border-outline-variant/20">
          <div>
            <div className="flex items-center justify-between mb-unit-xs">
              <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
                DNSSEC Delegation Signer
              </span>
              <span className="text-[10px] text-primary font-medium bg-surface-container px-1.5 py-0.5 rounded border border-outline-variant/20">
                DNS Retrieved
              </span>
            </div>
            <div className="flex items-center gap-unit-xs mb-unit-xs">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Active &amp; Cryptographically Signed
              </span>
            </div>
            <div className="font-caption-xs text-caption-xs text-on-surface-variant font-label-mono">
              {data.dnssecAlgorithm} • {data.dnssecKeyTag}
            </div>
          </div>
          <div className="mt-2 text-[10px] text-secondary font-label-mono">
            {data.dnssecDigest}
          </div>
        </div>
      </div>

      {/* Configured Records Table */}
      <div className="mt-unit-md">
        <div className="flex items-center justify-between mb-unit-xs">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
            Active Zone Records ({data.dnsRecords.length} Configured)
          </span>
          <button
            onClick={onOpenZoneFile}
            type="button"
            className="font-caption-xs text-caption-xs text-primary font-medium hover:underline cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">description</span>
            <span>View Zone File</span>
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-outline-variant/30">
          <table className="w-full text-left font-body-sm text-body-sm">
            <thead className="bg-surface-container-low text-secondary font-caption-xs text-caption-xs uppercase tracking-wider border-b border-outline-variant/20">
              <tr>
                <th className="py-2 px-3 font-semibold">Type</th>
                <th className="py-2 px-3 font-semibold">Name</th>
                <th className="py-2 px-3 font-semibold">Content / Routing Target</th>
                <th className="py-2 px-3 font-semibold">TTL</th>
                <th className="py-2 px-3 font-semibold text-right">Proxy State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/60 bg-surface-container-lowest">
              {data.dnsRecords.map((record) => (
                <tr
                  key={record.id}
                  className="hover:bg-surface-container-low/50 transition-colors"
                >
                  <td className="py-2 px-3 font-label-mono font-bold text-primary">
                    {record.type}
                  </td>
                  <td className="py-2 px-3 font-label-mono text-on-surface">
                    {record.name}
                  </td>
                  <td className="py-2 px-3 font-label-mono text-on-surface-variant truncate max-w-xs">
                    {record.content}
                  </td>
                  <td className="py-2 px-3 text-secondary font-label-mono text-caption-xs">
                    {record.ttl}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {record.proxied ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-medium border border-orange-200">
                        <span className="w-1 h-1 rounded-full bg-orange-500" /> Proxied
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container text-secondary text-[10px] font-medium border border-outline-variant/20">
                        DNS Only
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
