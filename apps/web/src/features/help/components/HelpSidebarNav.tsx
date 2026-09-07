import React from 'react';
import { HelpCategory } from '../help.types';
import { PRODUCT_METADATA } from '../help.reference';

interface HelpSidebarNavProps {
  activeCategory: HelpCategory;
  onSelectCategory: (cat: HelpCategory) => void;
}

const NAV_ITEMS: Array<{
  id: HelpCategory;
  label: string;
  icon: string;
  count: number;
}> = [
  { id: 'quick-start', label: 'Quick Start', icon: 'rocket_launch', count: 7 },
  { id: 'status', label: 'Status Explanation', icon: 'verified_user', count: 5 },
  { id: 'domain-data', label: 'Domain Data Specs', icon: 'dns', count: 8 },
  { id: 'features', label: 'Feature Guides', icon: 'auto_stories', count: 5 },
  { id: 'data-sources', label: 'Data Sources', icon: 'dataset', count: 5 },
  { id: 'monitoring', label: 'Monitoring Disclosure', icon: 'visibility_off', count: 1 },
  { id: 'security', label: 'Security & Privacy', icon: 'shield_lock', count: 1 },
  { id: 'faq', label: 'Knowledge Base & FAQ', icon: 'quiz', count: 15 },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: 'build_circle', count: 6 },
  { id: 'limitations', label: 'Data Limitations', icon: 'policy', count: 7 },
];

export const HelpSidebarNav: React.FC<HelpSidebarNavProps> = ({
  activeCategory,
  onSelectCategory,
}) => {
  return (
    <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-unit-md lg:h-full lg:overflow-y-auto lg:overflow-x-hidden pr-0 lg:pr-1">
      {/* Category Navigation List */}
      <div className="bg-surface-container-lowest rounded-xl p-unit-md shadow-micro border border-outline-variant/30">
        <div className="flex items-center justify-between mb-unit-sm pb-unit-xs border-b border-surface-container-low">
          <span className="font-label-md text-label-md uppercase tracking-wider text-secondary font-semibold">
            Help Categories
          </span>
          <span className="material-symbols-outlined text-[18px] text-outline">tune</span>
        </div>

        <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeCategory === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectCategory(item.id)}
                className={`w-full flex items-center justify-between px-unit-sm py-unit-xs rounded-lg text-left font-label-md text-label-md transition-all cursor-pointer ${
                  isActive
                    ? 'bg-surface-container text-primary font-semibold border border-primary/40 shadow-micro'
                    : 'bg-surface-container-low/70 text-secondary hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <div className="flex items-center gap-unit-xs min-w-0">
                  <span className="material-symbols-outlined text-[18px] shrink-0">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
                <span
                  className={`font-label-mono text-caption-xs px-1.5 py-0.5 rounded shrink-0 ml-1 ${
                    isActive
                      ? 'bg-primary text-on-primary font-semibold'
                      : 'bg-surface-container text-secondary'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Snapshot Callout Card */}
      <div className="bg-surface-container-low rounded-xl p-unit-md text-on-surface shadow-micro border border-outline-variant/30 flex flex-col gap-unit-xs">
        <div className="flex items-center gap-unit-xs text-primary">
          <span className="material-symbols-outlined text-[18px]">info</span>
          <span className="font-label-md text-label-md font-semibold">
            {PRODUCT_METADATA.workspace}
          </span>
        </div>
        <p className="font-caption-xs text-caption-xs text-secondary leading-relaxed">
          DomainPulse organizes portfolio inventory, relationship chains, and technical metadata. Live monitoring requires connected integrations.
        </p>
      </div>
    </aside>
  );
};
