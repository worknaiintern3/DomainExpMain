import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { WebsiteDetailData } from '../websiteDetails.types';

interface WebsiteDetailHeaderProps {
  data: WebsiteDetailData;
  onOpenEditModal: () => void;
  onExportRecord: () => void;
}

export const WebsiteDetailHeader: React.FC<WebsiteDetailHeaderProps> = ({
  data,
  onOpenEditModal,
  onExportRecord,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(data.primaryUrl).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col w-full">
      {/* Micro Breadcrumb & Subnav Context */}
      <div className="flex items-center justify-between pb-unit-md flex-wrap gap-unit-xs">
        <div className="flex items-center gap-unit-xs flex-wrap">
          <Link
            to="/websites"
            className="font-label-md text-label-md text-secondary hover:text-primary transition-colors flex items-center gap-1"
          >
            <span>Websites &amp; Apps</span>
          </Link>
          <span className="material-symbols-outlined text-secondary text-[14px]">chevron_right</span>
          <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
            {data.name}
          </span>
          <span className="ml-unit-sm px-unit-xs py-unit-2xs rounded bg-surface-container-high text-primary font-label-mono text-label-mono text-[10px] uppercase tracking-wider">
            Internal Record ID: {data.internalRecordId}
          </span>
        </div>
        <div className="flex items-center gap-unit-xs text-on-surface-variant font-caption-xs text-caption-xs">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container text-secondary font-caption-xs text-caption-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            Website Inventory Record
          </span>
        </div>
      </div>

      {/* Workspace Header Block */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm p-unit-lg flex flex-col md:flex-row md:items-center justify-between gap-unit-lg relative overflow-hidden border border-outline-variant/30">
        {/* Chromatic Accent Strip */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-tertiary to-surface-variant" />

        <div className="flex flex-col gap-unit-xs min-w-0">
          <div className="flex items-center gap-unit-sm flex-wrap">
            <h1 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
              {data.name}
            </h1>
            <div className="flex items-center gap-unit-xs flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-caption-xs text-caption-xs font-medium border ${
                  data.environment === 'Production'
                    ? 'bg-primary-fixed text-on-primary-fixed-variant border-primary/20'
                    : data.environment === 'Staging'
                    ? 'bg-tertiary-container/30 text-tertiary border-tertiary/20'
                    : 'bg-secondary-container text-on-secondary-container border-secondary/20'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {data.environment}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-caption-xs text-caption-xs font-medium border border-secondary/20">
                <span className="material-symbols-outlined text-[12px] text-primary">folder_open</span>
                Project: {data.project}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container text-tertiary font-caption-xs text-caption-xs font-semibold border border-outline-variant/30">
                <span className="material-symbols-outlined text-[12px] text-primary">
                  verified
                </span>
                SSL: {data.ssl.statusLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-unit-md text-secondary font-body-sm text-body-sm flex-wrap">
            <div className="flex items-center gap-1">
              <a
                href={data.primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:text-tertiary transition-colors group"
              >
                <span className="material-symbols-outlined text-[16px] text-primary group-hover:translate-x-0.5 transition-transform">
                  link
                </span>
                <span className="font-label-mono text-label-mono font-medium">{data.primaryUrl}</span>
                <span className="material-symbols-outlined text-[13px] text-secondary group-hover:text-primary">
                  north_east
                </span>
              </a>
              <button
                onClick={handleCopyUrl}
                className="text-secondary hover:text-primary transition-colors p-1 rounded"
                title="Copy Primary URL"
                type="button"
              >
                <span className={`material-symbols-outlined text-[14px] ${isCopied ? 'text-emerald-600' : ''}`}>
                  {isCopied ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>
            <span className="text-outline-variant">|</span>
            <span className="flex items-center gap-1 text-on-surface-variant font-caption-xs text-caption-xs">
              <span className="material-symbols-outlined text-[14px]">terminal</span>
              {data.techStackSummary}
            </span>
            <span className="text-outline-variant">•</span>
            <span className="font-caption-xs text-caption-xs text-secondary font-medium">
              Tech Metadata · User Added
            </span>
          </div>
        </div>

        {/* Actions Toolbar */}
        <div className="flex items-center gap-unit-xs shrink-0 flex-wrap">
          <a
            href={data.primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            <span>Open Website</span>
          </a>
          <button
            onClick={onOpenEditModal}
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-variant transition-colors border border-outline-variant/30"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Edit Configuration</span>
          </button>
          <Link
            to={`/servers/${data.hosting.serverId}`}
            className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md transition-colors border border-outline-variant/30"
          >
            <span className="material-symbols-outlined text-[16px]">hub</span>
            <span>View Node</span>
          </Link>
          <button
            onClick={onExportRecord}
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors border border-outline-variant/30"
            title="Export Asset Audit Record"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">ios_share</span>
          </button>
        </div>
      </div>
    </div>
  );
};
