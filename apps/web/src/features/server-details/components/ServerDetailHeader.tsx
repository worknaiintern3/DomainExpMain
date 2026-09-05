import React from 'react';
import { Link } from 'react-router-dom';
import { ServerDetailData } from '../serverDetails.types';

interface ServerDetailHeaderProps {
  data: ServerDetailData;
  onOpenEditModal: () => void;
  onOpenReminderModal: () => void;
  onExportSpecs: () => void;
}

export const ServerDetailHeader: React.FC<ServerDetailHeaderProps> = ({
  data,
  onOpenEditModal,
  onOpenReminderModal,
  onExportSpecs,
}) => {
  return (
    <div className="flex flex-col gap-unit-xs mb-unit-lg">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-unit-xs text-on-surface-variant font-caption-xs text-caption-xs">
        <Link to="/servers" className="hover:text-primary transition-colors">
          VPS &amp; Servers
        </Link>
        <span className="text-outline-variant">/</span>
        <span className="text-on-surface font-semibold">{data.name}</span>
      </div>

      {/* Main Header & Actions Row */}
      <div className="flex flex-wrap items-center justify-between gap-unit-md mt-unit-2xs">
        {/* Title & Badge Context */}
        <div className="flex items-center gap-unit-md flex-wrap">
          <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0 shadow-sm border border-outline-variant/30">
            <span className="material-symbols-outlined text-[24px]">dns</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-unit-sm flex-wrap">
              <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight font-semibold">
                {data.name}
              </h1>
              <span className="px-unit-sm py-unit-2xs rounded bg-surface-container-high text-primary font-label-mono text-label-mono font-medium border border-outline-variant/30">
                {data.hostname}
              </span>
              <span className="inline-flex items-center gap-1.5 px-unit-sm py-[2px] rounded-full bg-emerald-50 text-emerald-800 font-caption-xs text-caption-xs font-medium border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{data.statusLabel}</span>
              </span>
            </div>
            <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
              {data.provider} • Server Inventory Record
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-unit-xs flex-wrap">
          <button
            onClick={onOpenEditModal}
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors shadow-sm font-label-md text-label-md border border-outline-variant/30"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">edit</span>
            <span>Edit Server</span>
          </button>

          <button
            onClick={onOpenReminderModal}
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors shadow-sm font-label-md text-label-md border border-outline-variant/30"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">alarm</span>
            <span>Set Renewal Reminder</span>
          </button>

          <Link
            to="/websites"
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors shadow-sm font-label-md text-label-md border border-outline-variant/30"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">alt_route</span>
            <span>Manage Mapping</span>
          </Link>

          <button
            onClick={onExportSpecs}
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-primary text-on-primary hover:bg-primary-container shadow-sm transition-colors font-label-md text-label-md"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Export Specs</span>
          </button>
        </div>
      </div>
    </div>
  );
};
