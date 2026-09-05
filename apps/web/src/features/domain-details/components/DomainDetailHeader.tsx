import React from 'react';
import { Link } from 'react-router-dom';
import { DomainDetailData } from '../domainDetails.types';

interface DomainDetailHeaderProps {
  data: DomainDetailData;
  onOpenEditModal: () => void;
  onOpenTransferModal: () => void;
  onExportReport: () => void;
}

export const DomainDetailHeader: React.FC<DomainDetailHeaderProps> = ({
  data,
  onOpenEditModal,
  onOpenTransferModal,
  onExportReport,
}) => {
  return (
    <div className="flex flex-col gap-unit-md mb-unit-lg">
      {/* Top Breadcrumb Context */}
      <div className="flex items-center gap-unit-xs flex-wrap">
        <Link
          to="/domains"
          className="font-caption-xs text-caption-xs text-secondary hover:text-primary transition-colors font-medium"
        >
          DomainPulse
        </Link>
        <span className="text-secondary text-[12px]">/</span>
        <span className="font-caption-xs text-caption-xs text-secondary font-medium">
          Portfolio Workspace
        </span>
        <span className="text-secondary text-[12px]">/</span>
        <Link
          to="/domains"
          className="font-caption-xs text-caption-xs text-secondary hover:text-primary transition-colors font-medium"
        >
          Domains
        </Link>
        <span className="text-secondary text-[12px]">/</span>
        <span className="font-label-md text-label-md text-on-surface font-semibold font-label-mono">
          {data.domain}
        </span>
        <span className="ml-unit-sm px-unit-xs py-unit-2xs rounded bg-surface-container-high text-secondary text-[10px] font-label-mono text-label-mono border border-outline-variant/30">
          ID: {data.domainIdCode}
        </span>
      </div>

      {/* Main Title & Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-unit-md pt-unit-xs">
        <div className="flex flex-col gap-unit-xs min-w-0">
          <div className="flex flex-wrap items-center gap-unit-sm">
            <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight font-bold font-label-mono">
              {data.domain}
            </h1>
            {data.isApex && (
              <span className="inline-flex items-center px-unit-sm py-unit-2xs rounded-full bg-secondary-container text-on-secondary-fixed font-caption-xs text-caption-xs font-semibold uppercase tracking-wider">
                Apex Domain
              </span>
            )}
            <span
              className={`inline-flex items-center gap-unit-2xs px-unit-sm py-unit-2xs rounded-full font-caption-xs text-caption-xs font-semibold ${
                data.status === 'critical'
                  ? 'bg-error-container text-error'
                  : data.status === 'warning'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-[#ecfdf5] text-[#065f46]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  data.status === 'critical'
                    ? 'bg-error animate-pulse'
                    : data.status === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-[#10b981]'
                }`}
              />
              {data.statusLabel}
            </span>
            <span className="inline-flex items-center gap-unit-2xs px-unit-xs py-unit-2xs rounded bg-surface-container text-primary font-caption-xs text-caption-xs font-semibold border border-outline-variant/20">
              <span className="material-symbols-outlined text-[13px]">sync</span>
              RDAP &amp; DNS Retrieved
            </span>
            {data.dnssecActive && (
              <span className="inline-flex items-center gap-unit-2xs px-unit-xs py-unit-2xs rounded bg-surface-container-lowest text-on-surface-variant font-caption-xs text-caption-xs shadow-sm border border-outline-variant/30">
                <span className="material-symbols-outlined text-[13px] text-primary">verified_user</span>
                DNSSEC Active
              </span>
            )}
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl leading-relaxed">
            {data.description}
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-unit-xs shrink-0">
          <button
            onClick={onOpenEditModal}
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-md text-label-md shadow-sm transition-colors border border-outline-variant/30"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px] text-secondary">tune</span>
            <span>Edit Metadata</span>
          </button>
          <a
            href="#dns-section"
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-md text-label-md shadow-sm transition-colors border border-outline-variant/30"
          >
            <span className="material-symbols-outlined text-[17px] text-secondary">dns</span>
            <span>Manage DNS</span>
          </a>
          <button
            onClick={onOpenTransferModal}
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-md text-label-md shadow-sm transition-colors border border-outline-variant/30"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px] text-secondary">checklist_rtl</span>
            <span>Transfer Checklist</span>
          </button>
          <button
            onClick={onExportReport}
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px]">ios_share</span>
            <span>Export Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};
