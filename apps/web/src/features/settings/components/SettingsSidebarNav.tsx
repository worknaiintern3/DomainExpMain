import React from 'react';
import { SettingsCategory } from '../settings.types';
import { WORKSPACE_SUMMARY_DATA } from '../settings.reference';

interface SettingsSidebarNavProps {
  activeCategory: SettingsCategory;
  onSelectCategory: (cat: SettingsCategory) => void;
}

const CATEGORIES: Array<{
  id: SettingsCategory;
  label: string;
  icon: string;
  isDanger?: boolean;
}> = [
  { id: 'general', label: 'General', icon: 'tune' },
  { id: 'portfolio', label: 'Portfolio', icon: 'folder_special' },
  { id: 'domain-discovery', label: 'Domain Discovery', icon: 'travel_explore' },
  { id: 'alerts', label: 'Alerts & Notifications', icon: 'notifications_active' },
  { id: 'pricing', label: 'Pricing & Currency', icon: 'payments' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'integrations', label: 'Integrations', icon: 'cloud' },
  { id: 'data-management', label: 'Data Management', icon: 'dataset', isDanger: true },
];

export const SettingsSidebarNav: React.FC<SettingsSidebarNavProps> = ({
  activeCategory,
  onSelectCategory,
}) => {
  return (
    <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-unit-md">
      {/* Category Navigation Pill List */}
      <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-1 p-1 bg-surface-container-low/70 rounded-xl shadow-micro border border-outline-variant/30">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left font-label-md text-label-md transition-all cursor-pointer ${
                isActive
                  ? 'bg-surface-container-lowest text-primary shadow-micro font-semibold border border-outline-variant/30'
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container-lowest/60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`material-symbols-outlined text-[18px] shrink-0 ${
                    isActive
                      ? 'text-primary'
                      : cat.isDanger
                      ? 'text-error/80'
                      : 'text-secondary'
                  }`}
                >
                  {cat.icon}
                </span>
                <span className="truncate">{cat.label}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {cat.isDanger && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-error/70" />
                )}
                <span
                  className={`material-symbols-outlined text-[16px] transition-opacity ${
                    isActive ? 'text-primary opacity-100' : 'opacity-0'
                  }`}
                >
                  chevron_right
                </span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Storage & Version Meta Card */}
      <div className="rounded-xl bg-surface-container-low p-unit-md flex flex-col gap-unit-sm shadow-micro border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
            Storage &amp; Version
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-mono text-[10px]">
            Demo Build
          </span>
        </div>

        <div className="space-y-unit-xs pt-unit-xs">
          <div className="flex flex-col">
            <span className="font-caption-xs text-caption-xs text-secondary">Storage</span>
            <span className="font-label-md text-label-md text-on-surface font-medium">
              {WORKSPACE_SUMMARY_DATA.storage}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-caption-xs text-caption-xs text-secondary">Domain Data Sources</span>
            <span className="font-label-md text-label-md text-on-surface font-medium">
              {WORKSPACE_SUMMARY_DATA.domainDataSources}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-caption-xs text-caption-xs text-secondary">Pricing Mode</span>
            <span className="font-label-md text-label-md text-on-surface font-medium">
              {WORKSPACE_SUMMARY_DATA.pricingMode}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-caption-xs text-caption-xs text-secondary">Monitoring State</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              <span className="font-label-md text-label-md text-on-surface font-medium">
                {WORKSPACE_SUMMARY_DATA.monitoringState}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-unit-xs mt-unit-2xs border-t border-surface-container-high/60">
          <p className="font-caption-xs text-caption-xs text-outline leading-tight">
            Preferences stored in local demo session.
          </p>
        </div>
      </div>
    </aside>
  );
};
