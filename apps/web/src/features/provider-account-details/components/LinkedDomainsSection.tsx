import React from 'react';
import { Link } from 'react-router-dom';
import { LinkedDomainRecord } from '../providerAccountDetails.types';

interface LinkedDomainsSectionProps {
  domains: LinkedDomainRecord[];
}

export const LinkedDomainsSection: React.FC<LinkedDomainsSectionProps> = ({ domains }) => {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-unit-md shadow-sm border border-outline-variant/30">
      <div className="flex items-center justify-between mb-unit-sm">
        <div className="flex items-center gap-unit-xs">
          <span className="material-symbols-outlined text-primary text-[20px]">hub</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Linked Domains &amp; DNS Routing
          </h2>
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary font-mono">
          {domains.length} {domains.length === 1 ? 'Domain' : 'Domains'} Linked
        </span>
      </div>

      {domains.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-sm">
          {domains.map((dom) => (
            <div
              key={dom.id}
              className="p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[18px]">globe</span>
                  <Link
                    to={`/domains/${dom.domain}`}
                    className="font-label-mono text-label-mono font-semibold text-on-surface hover:text-primary transition-colors"
                  >
                    {dom.domain}
                  </Link>
                </div>
                <span
                  className={`font-caption-xs text-caption-xs px-2 py-0.5 rounded font-medium ${
                    dom.domainType === 'Apex Root'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {dom.domainType}
                </span>
              </div>

              <div className="mt-unit-sm space-y-1.5 text-caption-xs font-caption-xs text-secondary">
                <div className="flex items-center justify-between">
                  <span>DNS Routing Target:</span>
                  <span className="font-mono text-on-surface font-medium">{dom.dnsRoutingTarget}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Nameserver Status:</span>
                  <span className="text-on-surface font-medium inline-flex items-center gap-1">
                    <span className="font-mono">{dom.nameserver}</span>
                    <span className="text-[10px] text-primary bg-primary-fixed/50 px-1 py-0.2 rounded font-sans">
                      {dom.nameserverBadge}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>SSL / Edge Security:</span>
                  <span className="text-on-surface font-medium inline-flex items-center gap-1">
                    <span>{dom.sslProfile}</span>
                    <span
                      className={`text-[10px] px-1 py-0.2 rounded font-sans ${
                        dom.sslBadge === 'SSL Retrieved'
                          ? 'text-emerald-700 bg-emerald-50'
                          : 'text-primary bg-primary-fixed/50'
                      }`}
                    >
                      {dom.sslBadge}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-surface-container">
                  <span>Project:</span>
                  <span className="font-medium text-primary">{dom.projectName}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-unit-md text-center text-secondary text-body-sm bg-surface-container-low rounded-lg">
          No domains directly routing to this compute provider record.
        </div>
      )}
    </div>
  );
};
