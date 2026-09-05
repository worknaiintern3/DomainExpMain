import React from 'react';
import { AlertSeverity } from '../alerts.types';

interface AlertsToolbarProps {
  severityFilter: AlertSeverity | 'ALL';
  onSeverityChange: (sev: AlertSeverity | 'ALL') => void;
  unreadOnly: boolean;
  onToggleUnread: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  selectedRegistrar: string;
  onRegistrarChange: (reg: string) => void;
  counts: {
    all: number;
    critical: number;
    warning: number;
    upcoming: number;
    resolved: number;
    unread: number;
  };
}

export const AlertsToolbar: React.FC<AlertsToolbarProps> = ({
  severityFilter,
  onSeverityChange,
  unreadOnly,
  onToggleUnread,
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedRegistrar,
  onRegistrarChange,
  counts,
}) => {
  return (
    <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-micro flex flex-col gap-unit-md border border-outline-variant/30">
      {/* Severity Filter Pills Row */}
      <div className="flex flex-wrap items-center justify-between gap-unit-sm">
        <div className="flex flex-wrap items-center gap-unit-2xs">
          <button
            type="button"
            onClick={() => onSeverityChange('ALL')}
            className={`px-unit-sm py-1 rounded-full font-label-md text-label-md transition-colors cursor-pointer ${
              severityFilter === 'ALL'
                ? 'bg-primary text-on-primary font-semibold shadow-xs'
                : 'bg-surface-container text-secondary hover:text-on-surface'
            }`}
          >
            All Alerts ({counts.all})
          </button>

          <button
            type="button"
            onClick={() => onSeverityChange('CRITICAL')}
            className={`px-unit-sm py-1 rounded-full font-label-md text-label-md transition-colors cursor-pointer ${
              severityFilter === 'CRITICAL'
                ? 'bg-rose-700 text-white font-semibold shadow-xs'
                : 'bg-surface-container text-rose-700 hover:bg-rose-50'
            }`}
          >
            Critical ({counts.critical})
          </button>

          <button
            type="button"
            onClick={() => onSeverityChange('WARNING')}
            className={`px-unit-sm py-1 rounded-full font-label-md text-label-md transition-colors cursor-pointer ${
              severityFilter === 'WARNING'
                ? 'bg-amber-600 text-white font-semibold shadow-xs'
                : 'bg-surface-container text-amber-800 hover:bg-amber-50'
            }`}
          >
            Warning ({counts.warning})
          </button>

          <button
            type="button"
            onClick={() => onSeverityChange('UPCOMING')}
            className={`px-unit-sm py-1 rounded-full font-label-md text-label-md transition-colors cursor-pointer ${
              severityFilter === 'UPCOMING'
                ? 'bg-secondary-container text-primary font-semibold shadow-xs'
                : 'bg-surface-container text-secondary hover:text-on-surface'
            }`}
          >
            Upcoming ({counts.upcoming})
          </button>

          <button
            type="button"
            onClick={() => onSeverityChange('RESOLVED')}
            className={`px-unit-sm py-1 rounded-full font-label-md text-label-md transition-colors cursor-pointer ${
              severityFilter === 'RESOLVED'
                ? 'bg-surface-container-highest text-on-surface font-semibold shadow-xs'
                : 'bg-surface-container text-secondary hover:text-on-surface'
            }`}
          >
            Resolved ({counts.resolved})
          </button>
        </div>

        {/* Unread Only Toggle */}
        <label className="inline-flex items-center gap-unit-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={onToggleUnread}
            className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
          />
          <span className="font-label-md text-label-md text-on-surface font-medium">
            Unread Only ({counts.unread})
          </span>
        </label>
      </div>

      {/* Secondary Filter Bar (Search & Selects) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-unit-sm pt-unit-xs border-t border-surface-container/50">
        {/* Search alerts or domains */}
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-unit-sm text-secondary text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search alerts, domains, entities..."
            className="w-full h-9 pl-9 pr-unit-md rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30"
          />
        </div>

        {/* Alert Type Filter Dropdown */}
        <select
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value)}
          className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 cursor-pointer"
        >
          <option value="">Type: All Types</option>
          <option value="Domain Expiry">Domain Expiry</option>
          <option value="Auto-Renew">Auto-Renew</option>
          <option value="SSL Certificate">SSL Certificate</option>
          <option value="DNSSEC Alert">DNSSEC &amp; DNS</option>
          <option value="Server Renewal">Server Renewal</option>
          <option value="Unmapped Asset">Unmapped Asset</option>
          <option value="Upcoming Renewal">Upcoming Renewal</option>
        </select>

        {/* Registrar / Provider Filter Dropdown */}
        <select
          value={selectedRegistrar}
          onChange={(e) => onRegistrarChange(e.target.value)}
          className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 cursor-pointer"
        >
          <option value="">Registrar / Provider: All</option>
          <option value="GoDaddy">GoDaddy LLC</option>
          <option value="Hostinger">Hostinger</option>
          <option value="Namecheap">Namecheap</option>
          <option value="Cloudflare">Cloudflare</option>
          <option value="AWS">AWS Route 53 / AWS</option>
          <option value="Porkbun">Porkbun LLC</option>
        </select>
      </div>
    </div>
  );
};
