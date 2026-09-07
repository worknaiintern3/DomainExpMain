import React from 'react';
import { SidebarItem } from './SidebarItem';
import { NavItem } from '@/types';

const MAIN_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', path: '/overview', icon: 'grid_view' },
  { id: 'domains', label: 'My Domains', path: '/domains', icon: 'language' },
  { id: 'servers', label: 'VPS & Servers', path: '/servers', icon: 'dns' },
  { id: 'websites', label: 'Websites & Apps', path: '/websites', icon: 'web' },
  { id: 'accounts', label: 'Accounts & Emails', path: '/accounts', icon: 'alternate_email' },
  { id: 'find-domain', label: 'Find Domain', path: '/find-domain', icon: 'search' },
  { id: 'pricing', label: 'Price Comparison', path: '/pricing', icon: 'payments' },
  { id: 'alerts', label: 'Alerts & Monitoring', path: '/alerts', icon: 'notifications' },
  { id: 'infrastructure-map', label: 'Infrastructure Map', path: '/infrastructure-map', icon: 'hub' },
];

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Settings', path: '/settings', icon: 'settings' },
  { id: 'support', label: 'Help & Support', path: '/help', icon: 'help' },
];

export const Sidebar: React.FC = () => {
  return (
    <aside
      className="fixed left-0 top-0 h-full w-sidebar-width bg-surface-container-lowest text-on-surface z-50 flex flex-col justify-between select-none border-r border-outline-variant shadow-micro"
      aria-label="Sidebar Navigation"
    >
      {/* Top Header & Main Navigation Section */}
      <div className="flex flex-col min-h-0">
        {/* Brand Header */}
        <div className="h-header-height px-unit-lg flex items-center gap-unit-md border-b border-outline-variant/60">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-micro shrink-0">
            <span className="material-symbols-outlined text-[20px]">
              pulse_alert
            </span>
          </div>
          <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-semibold">
            DomainPulse
          </span>
        </div>

        {/* Workspace Selector Row */}
        <div className="px-unit-md pt-unit-sm pb-unit-2xs">
          <div className="flex items-center justify-between px-unit-sm py-unit-xs rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer text-secondary hover:text-on-surface border border-outline-variant/60 group">
            <div className="flex items-center gap-unit-xs min-w-0">
              <span className="material-symbols-outlined text-[18px] text-secondary group-hover:text-primary transition-colors">
                domain
              </span>
              <span className="font-label-md text-label-md text-on-surface font-medium truncate">
                Portfolio Workspace
              </span>
            </div>
            <span className="material-symbols-outlined text-secondary group-hover:text-on-surface text-[18px] transition-colors">
              unfold_more
            </span>
          </div>
        </div>

        {/* Primary Navigation List */}
        <nav
          className="flex flex-col gap-unit-2xs px-unit-md mt-unit-xs overflow-y-auto max-h-[calc(100vh-18rem)] py-1"
          aria-label="Main Navigation"
        >
          {MAIN_NAV_ITEMS.map((item) => (
            <SidebarItem key={item.id} item={item} />
          ))}
        </nav>
      </div>

      {/* Bottom Pinned Settings & User Profile Section */}
      <div className="flex flex-col gap-unit-xs px-unit-md pb-unit-md pt-unit-xs border-t border-outline-variant/60 bg-surface-container-lowest shrink-0">
        {/* Settings & Support Links */}
        <nav className="flex flex-col gap-unit-2xs" aria-label="Secondary Navigation">
          {BOTTOM_NAV_ITEMS.map((item) => (
            <SidebarItem key={item.id} item={item} />
          ))}
        </nav>

        {/* Profile Card Footer */}
        <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer mt-unit-xs border border-outline-variant/60 group">
          <div className="flex items-center gap-unit-sm min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary font-mono text-caption-xs font-semibold shadow-micro">
              AD
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                Aman Developer
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary truncate">
                Portfolio Workspace
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-secondary group-hover:text-on-surface text-[18px] transition-colors">
            unfold_more
          </span>
        </div>
      </div>
    </aside>
  );
};
