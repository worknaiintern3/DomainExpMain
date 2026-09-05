import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DomainRecord } from '../domains.types';

interface DomainInspectorDrawerProps {
  domain: DomainRecord | null;
  onClose: () => void;
  onOpenEditModal: (domain: DomainRecord) => void;
}

export const DomainInspectorDrawer: React.FC<DomainInspectorDrawerProps> = ({
  domain,
  onClose,
  onOpenEditModal,
}) => {
  const navigate = useNavigate();

  if (!domain) return null;

  return (
    <aside
      className="w-full lg:w-[380px] shrink-0 bg-surface-container-lowest rounded-xl shadow-md p-unit-lg flex flex-col gap-unit-md transition-all border border-outline-variant/40"
      aria-label="Domain Details Inspector"
    >
      {/* Header */}
      <div className="flex items-start justify-between pb-unit-sm border-b border-surface-container">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-label-mono tracking-tight font-semibold truncate max-w-[220px]">
              {domain.domain}
            </h3>
            {domain.status === 'critical' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-error text-caption-xs font-label-md font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" /> Critical
              </span>
            ) : domain.status === 'warning' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-caption-xs font-label-md font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Warning
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-caption-xs font-label-md font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Healthy
              </span>
            )}
          </div>
          <p className="font-caption-xs text-caption-xs text-secondary mt-1">
            Domain details &amp; portfolio information
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container text-secondary hover:text-on-surface transition-colors"
          type="button"
          title="Close details"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {/* Quick Summary Metrics Bento */}
      <div className="grid grid-cols-2 gap-unit-xs">
        <div className="bg-surface-container-low p-unit-sm rounded-lg flex flex-col border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs uppercase text-secondary font-medium">
            Days Left
          </span>
          <span
            className={`font-headline-sm text-headline-sm font-semibold font-label-mono ${
              domain.status === 'critical'
                ? 'text-error'
                : domain.status === 'warning'
                ? 'text-amber-700'
                : 'text-on-surface'
            }`}
          >
            {domain.daysRemaining} days
          </span>
        </div>
        <div className="bg-surface-container-low p-unit-sm rounded-lg flex flex-col border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs uppercase text-secondary font-medium">
            Renewal Cost
          </span>
          <span className="font-headline-sm text-headline-sm font-semibold text-primary font-label-mono">
            {domain.renewalCostFormatted}/yr
          </span>
        </div>
      </div>

      {/* Technical Specs Strip */}
      <div className="flex flex-col gap-unit-xs py-unit-xs text-caption-xs font-label-md">
        <div className="flex justify-between py-1 border-b border-surface-container">
          <span className="text-secondary">Registrar</span>
          <span className="text-on-surface font-semibold">{domain.registrar} LLC</span>
        </div>
        <div className="flex justify-between py-1 border-b border-surface-container">
          <span className="text-secondary">Nameservers</span>
          <span className="font-label-mono text-on-surface text-right truncate max-w-[180px]">
            {domain.nameservers.join(', ')}
          </span>
        </div>
        <div className="flex justify-between py-1 border-b border-surface-container">
          <span className="text-secondary">SSL Certificate</span>
          <span className="text-emerald-700 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">lock</span>
            <span>{domain.sslProvider}</span>
          </span>
        </div>
        <div className="flex justify-between py-1 border-b border-surface-container">
          <span className="text-secondary">Auto-Renew</span>
          {domain.autoRenew ? (
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              <span>On</span>
            </span>
          ) : (
            <span className="text-error font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">cancel</span>
              <span>Off</span>
            </span>
          )}
        </div>
        <div className="flex justify-between py-1 border-b border-surface-container">
          <span className="text-secondary">WHOIS Privacy</span>
          <span className="text-on-surface font-semibold">
            {domain.whoisPrivacy ? 'Enabled (Privacy Guard)' : 'Disabled'}
          </span>
        </div>
        <div className="flex justify-between py-1 border-b border-surface-container">
          <span className="text-secondary">Assigned Project</span>
          <span className="px-2 py-0.5 rounded bg-surface-container text-primary font-label-mono font-medium">
            {domain.projectTag}
          </span>
        </div>
      </div>

      {/* Operational Notes Callout */}
      {domain.notes && (
        <div className="bg-amber-50 rounded-lg p-unit-sm text-amber-900 flex items-start gap-unit-xs border border-amber-200">
          <span className="material-symbols-outlined text-[18px] text-amber-700 shrink-0 mt-0.5">
            info
          </span>
          <div className="flex flex-col">
            <span className="font-label-md text-caption-xs font-bold uppercase tracking-wider text-amber-800">
              Renewal Note
            </span>
            <p className="font-caption-xs text-caption-xs text-amber-900 mt-0.5 leading-relaxed">
              {domain.notes}
            </p>
          </div>
        </div>
      )}

      {/* Action CTAs */}
      <div className="flex flex-col gap-unit-xs mt-unit-xs">
        <Link
          to={`/domains/${domain.domain}`}
          className="w-full h-9 rounded-lg bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:bg-primary-container flex items-center justify-center gap-1.5 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">payment</span>
          <span>Review Renewal</span>
        </Link>
        <div className="grid grid-cols-2 gap-unit-xs">
          <button
            onClick={() => onOpenEditModal(domain)}
            className="h-8 rounded-lg bg-surface-container text-on-surface font-label-md text-caption-xs hover:bg-surface-container-high transition-colors border border-outline-variant/30"
            type="button"
          >
            Edit Domain
          </button>
          <button
            onClick={() => navigate(`/domains/${domain.domain}`)}
            className="h-8 rounded-lg bg-surface-container text-on-surface font-label-md text-caption-xs hover:bg-surface-container-high transition-colors border border-outline-variant/30"
            type="button"
          >
            View Full Audit
          </button>
        </div>
      </div>
    </aside>
  );
};
