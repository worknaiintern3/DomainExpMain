import React from 'react';
import { Link } from 'react-router-dom';
import { WebsiteDnsData } from '../websiteDetails.types';

interface DomainRoutingSectionProps {
  dns: WebsiteDnsData;
  primaryDomain: string;
}

export const DomainRoutingSection: React.FC<DomainRoutingSectionProps> = ({
  dns,
  primaryDomain,
}) => {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm p-unit-base flex flex-col justify-between border border-outline-variant/30">
      <div className="flex flex-col">
        {/* Section Header */}
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-primary text-[18px]">dns</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Domain &amp; DNS Routing
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-caption-xs text-caption-xs text-secondary font-semibold uppercase">
              DNS Provider
            </span>
            <span className="px-unit-xs py-0.5 rounded bg-surface-container-low text-primary font-caption-xs text-caption-xs font-semibold border border-outline-variant/20">
              {dns.provider}
            </span>
          </div>
        </div>

        {/* Content Details */}
        <div className="flex flex-col gap-unit-xs mt-unit-sm">
          {/* Base Domain Card */}
          <div className="bg-surface-container-low p-unit-sm rounded-lg flex flex-col gap-0.5 border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-caption-xs text-caption-xs text-secondary font-medium uppercase tracking-wider">
                Base Domain
              </span>
              <span className="font-caption-xs text-caption-xs text-primary font-semibold">
                {dns.status}
              </span>
            </div>
            <span className="font-label-mono text-label-mono text-on-surface font-bold text-[13px]">
              {primaryDomain}
            </span>
            <div className="flex items-center justify-between mt-1 text-secondary font-caption-xs text-caption-xs flex-wrap gap-1">
              <span>
                Registrar: <strong className="text-on-surface font-medium">{dns.registrar}</strong>
              </span>
              <span className="font-label-mono">Registration: {dns.registrationEmail}</span>
            </div>
          </div>

          {/* Nameservers Delegation */}
          <div className="bg-surface-container-low p-unit-sm rounded-lg flex flex-col gap-0.5 border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary font-medium uppercase tracking-wider">
              DNS Delegation (Nameservers)
            </span>
            <div className="grid grid-cols-2 gap-unit-xs mt-1">
              {dns.nameservers.map((ns) => (
                <div
                  key={ns}
                  className="bg-surface-container-lowest px-unit-xs py-1 rounded flex items-center gap-1 font-label-mono text-label-mono text-[11px] text-on-surface border border-outline-variant/20 truncate"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="truncate">{ns}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Configured Records */}
          <div className="flex flex-col gap-unit-2xs mt-unit-2xs">
            <div className="flex items-center justify-between">
              <span className="font-caption-xs text-caption-xs text-secondary font-semibold uppercase tracking-wider">
                Configured Resolution Records
              </span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container text-primary font-caption-xs text-[10px] font-medium border border-outline-variant/20">
                {dns.provenance}
              </span>
            </div>

            {dns.records.map((rec, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-surface-container-lowest p-unit-xs px-unit-sm rounded-lg shadow-sm border border-outline-variant/20"
              >
                <div className="flex items-center gap-unit-sm">
                  <span
                    className={`px-1.5 py-0.5 rounded font-label-mono text-label-mono text-[10px] font-bold ${
                      rec.type === 'A'
                        ? 'bg-primary-container text-on-primary'
                        : 'bg-surface-container-high text-tertiary'
                    }`}
                  >
                    {rec.type}
                  </span>
                  <span className="font-label-mono text-label-mono text-on-surface font-semibold">
                    {rec.name}
                  </span>
                  <span className="text-secondary text-[12px]">→</span>
                  <span className="font-label-mono text-label-mono text-on-surface-variant text-[11px]">
                    {rec.target}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-caption-xs text-caption-xs font-semibold ${
                    rec.badgeType === 'proxied'
                      ? 'bg-secondary-container text-on-secondary-fixed'
                      : 'bg-surface-container text-secondary'
                  }`}
                >
                  {rec.badgeType === 'proxied' && (
                    <span className="material-symbols-outlined text-[12px] text-primary">
                      cloud_done
                    </span>
                  )}
                  {rec.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="pt-unit-sm mt-unit-sm flex items-center justify-between font-caption-xs text-caption-xs text-secondary border-t border-surface-container">
        <span>Stored DNS Mapping Available</span>
        <Link
          to={`/domains/${primaryDomain}`}
          className="text-primary hover:underline font-medium flex items-center gap-1"
        >
          <span>View DNS Mapping</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
};
