import React from 'react';
import { Link } from 'react-router-dom';
import { ServerRecord } from '../servers.types';

interface ServerInspectorDrawerProps {
  server: ServerRecord | null;
  onClose: () => void;
  onOpenEditModal: (server: ServerRecord) => void;
}

export const ServerInspectorDrawer: React.FC<ServerInspectorDrawerProps> = ({
  server,
  onClose,
  onOpenEditModal,
}) => {
  if (!server) return null;

  return (
    <div className="w-full xl:w-[420px] shrink-0 bg-surface-container-lowest rounded-xl shadow-md p-unit-lg flex flex-col gap-unit-md relative border border-outline-variant/30">
      {/* Drawer Header */}
      <div className="flex items-start justify-between gap-unit-sm pb-unit-sm border-b border-surface-container">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-unit-xs">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
              {server.name}
            </h3>
            {server.status === 'attention' ? (
              <div className="inline-flex items-center gap-1 px-unit-xs py-0.5 rounded-full bg-amber-50 text-amber-800 font-caption-xs text-caption-xs font-medium shrink-0 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Needs Attention</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-unit-xs py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-caption-xs text-caption-xs font-medium shrink-0 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Inventory: Active</span>
              </div>
            )}
          </div>
          <span className="font-label-mono text-caption-xs text-secondary mt-unit-2xs">
            {server.hostname}.worknai.internal
          </span>
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

      {/* Provider & Account Context Tile */}
      <div className="bg-surface-container-low p-unit-md rounded-lg flex flex-col gap-unit-xs border border-outline-variant/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-[18px] text-primary">cloud_circle</span>
            <span className="font-label-md text-label-md font-semibold text-on-surface">
              {server.provider} Cloud
            </span>
          </div>
        </div>
        <div className="flex flex-col mt-unit-2xs gap-0.5">
          <span className="font-caption-xs text-caption-xs text-secondary">Account Name</span>
          <span className="font-label-md text-label-md text-on-surface font-medium">
            {server.accountName}
          </span>
        </div>
        <div className="flex flex-col mt-unit-2xs gap-0.5">
          <span className="font-caption-xs text-caption-xs text-secondary">Account Email</span>
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-[14px] text-primary">mail</span>
            <span className="font-label-mono text-caption-xs font-semibold text-primary truncate">
              {server.accountEmail}
            </span>
          </div>
        </div>
      </div>

      {/* Hardware & Network Configuration Matrix */}
      <div className="flex flex-col gap-unit-xs">
        <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
          Hardware &amp; Network Configuration
        </span>
        <div className="grid grid-cols-2 gap-unit-xs font-body-sm text-body-sm">
          <div className="p-unit-sm rounded bg-surface-container-low flex flex-col border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary">Public IP Address</span>
            <span className="font-label-mono text-caption-xs font-semibold text-on-surface mt-unit-2xs">
              {server.ipAddress}
            </span>
          </div>
          <div className="p-unit-sm rounded bg-surface-container-low flex flex-col border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary">Region / Datacenter</span>
            <span className="font-body-sm text-caption-xs font-medium text-on-surface mt-unit-2xs">
              {server.region} ({server.regionCode})
            </span>
          </div>
          <div className="p-unit-sm rounded bg-surface-container-low flex flex-col border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary">OS Platform</span>
            <span className="font-body-sm text-caption-xs font-medium text-on-surface mt-unit-2xs">
              {server.osPlatform}
            </span>
          </div>
          <div className="p-unit-sm rounded bg-surface-container-low flex flex-col border border-outline-variant/20">
            <span className="font-caption-xs text-caption-xs text-secondary">Compute Specs</span>
            <span className="font-label-mono text-caption-xs font-semibold text-on-surface mt-unit-2xs">
              {server.vcpuCount} vCPU / {server.ramGb} GB RAM
            </span>
          </div>
          <div className="p-unit-sm rounded bg-surface-container-low flex flex-col col-span-2 border border-outline-variant/20">
            <div className="flex justify-between items-center">
              <span className="font-caption-xs text-caption-xs text-secondary">
                Storage Allocation ({server.storageType})
              </span>
              <span className="font-label-mono text-caption-xs text-on-surface font-semibold">
                {server.storageGb} GB Total
              </span>
            </div>
            <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-unit-xs overflow-hidden">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: `${server.storageProgressPercentage}%` }}
              />
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
              <span className="font-caption-xs text-caption-xs text-secondary">
                Storage Capacity: {server.storageGb} GB
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary opacity-75">
                Usage monitoring not connected.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial & Renewal Billing Box */}
      <div className="p-unit-md rounded-lg bg-surface-container-low flex items-center justify-between border border-outline-variant/20">
        <div className="flex flex-col">
          <span className="font-caption-xs text-caption-xs text-secondary">Billing Schedule</span>
          <span className="font-headline-sm text-headline-sm font-semibold text-on-surface font-label-mono">
            {server.monthlyCostFormatted}
            <span className="font-body-sm text-caption-xs text-secondary font-normal font-sans"> /mo</span>
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
            Annualized estimate: {server.annualizedRunRateFormatted}
          </span>
        </div>
        <div className="flex flex-col text-right">
          <span className="font-caption-xs text-caption-xs text-secondary">Next Expiration</span>
          <span className="font-label-mono text-caption-xs font-bold text-on-surface mt-1">
            {server.renewalDateFormatted}
          </span>
          <span className="font-caption-xs text-caption-xs text-emerald-700 font-semibold">
            {server.autoRenew ? 'Auto-Renew: User Marked On' : 'Auto-Renew: User Marked Off'}
          </span>
        </div>
      </div>

      {/* Connected Websites Section */}
      <div className="flex flex-col gap-unit-xs">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
            Connected Websites ({server.connectedWebsites.length})
          </span>
          <Link
            to="/websites"
            className="font-caption-xs text-caption-xs text-primary font-medium cursor-pointer hover:underline"
          >
            Manage Mappings
          </Link>
        </div>
        <div className="flex flex-col gap-1.5">
          {server.connectedWebsites.map((web) => (
            <div
              key={web.id}
              className="flex items-center justify-between p-unit-xs rounded bg-surface-container-low hover:bg-surface-container transition-colors border border-outline-variant/20"
            >
              <div className="flex items-center gap-unit-xs min-w-0">
                <span className="material-symbols-outlined text-[16px] text-secondary">language</span>
                <span className="font-label-mono text-caption-xs font-medium text-on-surface truncate">
                  {web.domain}
                </span>
                {web.sslAvailable && (
                  <span className="inline-flex items-center gap-0.5 px-unit-xs py-0.5 rounded bg-emerald-50 text-emerald-800 font-caption-xs text-[11px] border border-emerald-200">
                    <span className="material-symbols-outlined text-[12px]">lock</span>
                    <span>SSL: Recorded</span>
                  </span>
                )}
              </div>
              <span className="px-unit-xs py-0.5 rounded bg-surface-container-highest text-secondary font-caption-xs text-caption-xs font-medium">
                {web.tag}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Honest Infrastructure Monitoring Status Note */}
      <div className="p-unit-sm rounded-lg bg-surface-container-low flex flex-col gap-unit-xs border border-outline-variant/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-[16px] text-secondary">monitoring</span>
            <span className="font-label-md text-caption-xs font-semibold text-on-surface">
              Server Monitoring
            </span>
          </div>
          <span className="px-unit-xs py-0.5 rounded bg-surface-container-highest text-secondary font-caption-xs text-caption-xs font-medium border border-outline-variant/20">
            Not Connected
          </span>
        </div>
        <span className="font-body-sm text-caption-xs text-secondary mt-0.5 leading-relaxed">
          DomainPulse currently stores server inventory and relationship information. Live CPU, memory, disk and uptime monitoring requires a connected monitoring integration.
        </span>
      </div>

      {/* Sticky Action Footer */}
      <div className="pt-unit-xs flex flex-col gap-unit-xs mt-auto">
        <Link
          to={`/servers/${server.id}`}
          className="w-full h-9 flex items-center justify-center gap-unit-xs rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors"
        >
          <span>View Full Server Page</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
        <div className="flex items-center gap-unit-xs">
          <button
            onClick={() => onOpenEditModal(server)}
            className="flex-1 h-8 flex items-center justify-center gap-unit-xs rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors border border-outline-variant/30"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">edit</span>
            <span>Edit Server</span>
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
