import React from 'react';

import { useAuth } from '@/auth/AuthContext';
import { NavItem } from '@/types';
import { SidebarItem } from './SidebarItem';

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
  { id: 'security', label: 'Security', path: '/security', icon: 'shield_person' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: 'settings' },
  { id: 'support', label: 'Help & Support', path: '/help', icon: 'help' },
];

function initialsFor(label: string): string {
  return label
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'DP';
}

export const Sidebar: React.FC = () => {
  const { logout, user } = useAuth();
  const userLabel = user?.displayName?.trim() || user?.email || 'Signed-in user';

  return (
    <aside
      className="fixed left-0 top-0 h-full w-sidebar-width bg-surface-container-lowest text-on-surface z-50 flex flex-col justify-between select-none border-r border-outline-variant shadow-micro"
      aria-label="Sidebar navigation"
    >
      <div className="flex flex-col min-h-0">
        <div className="h-header-height px-unit-lg flex items-center gap-unit-md border-b border-outline-variant/60">
          <img
            src="/logo.png"
            alt="DomainPulse"
            className="w-8 h-8 rounded-lg object-cover shadow-micro shrink-0 border border-outline-variant/30"
          />
          <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-semibold">DomainPulse</span>
        </div>

        <div className="px-unit-md pt-unit-sm pb-unit-2xs">
          <div className="flex items-center px-unit-sm py-unit-xs rounded-lg bg-surface-container-low text-secondary border border-outline-variant/60">
            <div className="flex items-center gap-unit-xs min-w-0">
              <span className="material-symbols-outlined text-[18px] text-primary">person</span>
              <span className="font-label-md text-label-md text-on-surface font-medium truncate">Personal workspace</span>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-unit-2xs px-unit-md mt-unit-xs overflow-y-auto max-h-[calc(100vh-18rem)] py-1" aria-label="Main navigation">
          {MAIN_NAV_ITEMS.map((item) => <SidebarItem key={item.id} item={item} />)}
        </nav>
      </div>

      <div className="flex flex-col gap-unit-xs px-unit-md pb-unit-md pt-unit-xs border-t border-outline-variant/60 bg-surface-container-lowest shrink-0">
        <nav className="flex flex-col gap-unit-2xs" aria-label="Secondary navigation">
          {BOTTOM_NAV_ITEMS.map((item) => <SidebarItem key={item.id} item={item} />)}
        </nav>

        <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low mt-unit-xs border border-outline-variant/60">
          <div className="flex items-center gap-unit-sm min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary font-mono text-caption-xs font-semibold shadow-micro">{initialsFor(userLabel)}</div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-md text-label-md text-on-surface font-semibold truncate">{userLabel}</span>
              <span className="font-caption-xs text-caption-xs text-secondary truncate">Personal workspace</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-8 h-8 rounded-lg text-secondary hover:text-error hover:bg-surface-container flex items-center justify-center transition-colors shrink-0"
            aria-label="Sign out"
            title="Sign out"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
