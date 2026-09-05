import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { WebsiteRecord } from '../websites.types';

interface WebsiteInspectorDrawerProps {
  website: WebsiteRecord | null;
  onClose: () => void;
  onOpenEditModal: (website: WebsiteRecord) => void;
}

export const WebsiteInspectorDrawer: React.FC<WebsiteInspectorDrawerProps> = ({
  website,
  onClose,
  onOpenEditModal,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  if (!website) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(`https://${website.domain}`).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="w-full xl:w-[420px] shrink-0 bg-surface-container-lowest rounded-xl shadow-md p-unit-lg flex flex-col gap-unit-md relative border border-outline-variant/30">
      {/* Drawer Header */}
      <div className="flex items-start justify-between gap-unit-sm pb-unit-sm border-b border-surface-container">
        <div className="flex items-center gap-unit-sm min-w-0">
          <div
            className={`w-9 h-9 rounded-lg ${website.avatarBgColor} ${website.avatarTextColor} flex items-center justify-center shrink-0 font-bold font-mono text-[14px] border border-outline-variant/20`}
          >
            {website.avatarLetter}
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
              {website.name}
            </h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full font-caption-xs text-caption-xs font-medium w-fit mt-1 border ${
                website.environment === 'Production'
                  ? 'bg-primary-fixed text-on-primary-fixed-variant border-primary/20'
                  : website.environment === 'Staging'
                  ? 'bg-tertiary-container/30 text-tertiary border-tertiary/20'
                  : 'bg-secondary-container text-on-secondary-container border-secondary/20'
              }`}
            >
              {website.environment}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-secondary hover:text-on-surface p-unit-2xs rounded-lg hover:bg-surface-container transition-colors"
          type="button"
          title="Close inspector"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Primary Domain & Route Tile */}
      <div className="bg-surface-container-low p-unit-md rounded-lg flex flex-col gap-unit-xs border border-outline-variant/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-[18px] text-primary">language</span>
            <span className="font-label-mono text-label-md font-bold text-on-surface">
              {website.domain}
            </span>
          </div>
          <button
            onClick={handleCopyUrl}
            className="text-secondary hover:text-primary transition-colors p-1 rounded"
            title="Copy Domain URL"
            type="button"
          >
            <span className={`material-symbols-outlined text-[16px] ${isCopied ? 'text-emerald-600' : ''}`}>
              {isCopied ? 'check' : 'content_copy'}
            </span>
          </button>
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary mt-0.5 font-mono">
          Route Note: {website.routeNote}
        </span>
      </div>

      {/* Runtime & Stack Configuration */}
      <div className="flex flex-col gap-unit-xs">
        <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
          Runtime Configuration
        </span>
        <div className="grid grid-cols-2 gap-unit-xs font-body-sm text-body-sm">
          <div className="p-unit-sm rounded bg-surface-container-low flex flex-col border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary">Tech Stack</span>
            <span className="font-label-md text-caption-xs font-semibold text-on-surface mt-unit-2xs">
              {website.techStack}
            </span>
          </div>
          <div className="p-unit-sm rounded bg-surface-container-low flex flex-col border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary">Configured Port</span>
            <span className="font-label-mono text-caption-xs font-bold text-primary mt-unit-2xs">
              Port :{website.port}
            </span>
          </div>
          <div className="p-unit-sm rounded bg-surface-container-low flex flex-col border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary">Reverse Proxy</span>
            <span className="font-label-md text-caption-xs font-medium text-on-surface mt-unit-2xs">
              {website.reverseProxy}
            </span>
          </div>
          <div className="p-unit-sm rounded bg-surface-container-low flex flex-col border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary">Project Group</span>
            <span className="font-label-md text-caption-xs font-medium text-on-surface mt-unit-2xs">
              {website.project}
            </span>
          </div>
        </div>
      </div>

      {/* Hosted Server Mapping */}
      <div className="p-unit-md rounded-lg bg-surface-container-low flex flex-col gap-unit-xs border border-outline-variant/20">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
            Hosting Infrastructure
          </span>
          <Link
            to={`/servers/${website.serverId}`}
            className="font-caption-xs text-caption-xs text-primary font-medium hover:underline"
          >
            View Server
          </Link>
        </div>
        <div className="flex items-center gap-unit-xs mt-1">
          <span className="material-symbols-outlined text-[16px] text-primary">dns</span>
          <span className="font-label-md text-label-md font-semibold text-on-surface">
            {website.serverName}
          </span>
          <span className="text-secondary font-caption-xs">({website.serverProvider})</span>
        </div>
        <div className="grid grid-cols-2 gap-unit-xs mt-1 text-caption-xs font-caption-xs">
          <div className="flex flex-col">
            <span className="text-secondary">Server IP</span>
            <span className="font-label-mono font-semibold text-on-surface">{website.ipAddress}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-secondary">Account Email</span>
            <span className="font-label-mono font-semibold text-primary truncate">
              {website.serverAccountEmail}
            </span>
          </div>
        </div>
      </div>

      {/* SSL Reference Certificate Box */}
      <div className="p-unit-sm rounded-lg bg-surface-container-low flex flex-col gap-unit-xs border border-outline-variant/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-[16px] text-emerald-700">lock</span>
            <span className="font-label-md text-caption-xs font-semibold text-on-surface">
              SSL Certificate (Stored Record)
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium ${
              website.sslStatus === 'warning'
                ? 'bg-error-container text-on-error-container'
                : website.sslStatus === 'expiring'
                ? 'bg-amber-100 text-amber-900'
                : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {website.sslLabel}
          </span>
        </div>
        <span className="font-body-sm text-caption-xs text-secondary mt-0.5">
          {website.sslDetails}
        </span>
      </div>

      {/* Informational Monitoring Disclaimer */}
      <div className="p-unit-sm rounded-lg bg-surface-container-low flex flex-col gap-unit-xs border border-outline-variant/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-[16px] text-secondary">monitoring</span>
            <span className="font-label-md text-caption-xs font-semibold text-on-surface">
              Application Monitoring
            </span>
          </div>
          <span className="px-unit-xs py-0.5 rounded bg-surface-container-highest text-secondary font-caption-xs text-caption-xs font-medium border border-outline-variant/20">
            Not Connected
          </span>
        </div>
        <span className="font-body-sm text-caption-xs text-secondary mt-0.5 leading-relaxed">
          DomainPulse stores configuration inventory and domain mappings. Live process uptime and response-time monitoring requires a connected monitoring integration.
        </span>
      </div>

      {/* Sticky Action Footer */}
      <div className="pt-unit-xs flex flex-col gap-unit-xs mt-auto">
        <Link
          to={`/websites/${website.id}`}
          className="w-full h-9 flex items-center justify-center gap-unit-xs rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors"
        >
          <span>View Full App Page</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
        <div className="flex items-center gap-unit-xs">
          <button
            onClick={() => onOpenEditModal(website)}
            className="flex-1 h-8 flex items-center justify-center gap-unit-xs rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors border border-outline-variant/30"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">edit</span>
            <span>Edit Mapping</span>
          </button>
          <button
            onClick={onClose}
            className="h-8 px-unit-md flex items-center justify-center rounded-lg bg-surface-container-low hover:bg-surface-container text-secondary font-label-md text-label-md transition-colors border border-outline-variant/30"
            type="button"
          >
            <span>Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
