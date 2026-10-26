import React, { useEffect, useState, useMemo } from 'react';

import { getMobileAdminConfig } from '@/api/mobile-admin';
import { useAuth } from '@/auth/AuthContext';
import {
  loadAppearancePreferences,
  readSidebarManuallyCollapsed,
  setSidebarManuallyCollapsed,
  useSidebarCollapsed,
} from '@/lib/appearance';
import { usePreferences } from '@/preferences/PreferencesContext';
import { NavItem } from '@/types';
import { SidebarItem } from './SidebarItem';
import { fetchPortfolioSummary } from '@/services/portfolioService';

const BASE_MAIN_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', path: '/overview', icon: 'grid_view' },
  { id: 'domains', label: 'My Domains', path: '/domains', icon: 'language' },
  { id: 'servers', label: 'VPS & Servers', path: '/servers', icon: 'dns' },
  { id: 'websites', label: 'Websites & Apps', path: '/websites', icon: 'web' },
  { id: 'projects', label: 'Projects', path: '/projects', icon: 'workspaces' },
  { id: 'cloud-resources', label: 'Cloud Resources', path: '/cloud-resources', icon: 'cloud' },
  { id: 'accounts', label: 'Accounts & Emails', path: '/accounts', icon: 'alternate_email' },
  { id: 'find-domain', label: 'Find Domain', path: '/find-domain', icon: 'search' },
  { id: 'domain-intelligence', label: 'Domain Intelligence', path: '/domain-intelligence', icon: 'travel_explore' },
  { id: 'pricing', label: 'Price Comparison', path: '/pricing', icon: 'payments' },
  { id: 'google-play', label: 'Google Play Console', path: '/google-play', icon: { src: '/google-play.png', style: { filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' } } },
  { id: 'play-store', label: 'Play Store Search', path: '/play-store', icon: { src: '/google-play.png', style: { filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' } } },
  { id: 'alerts', label: 'Alerts & Monitoring', path: '/alerts', icon: 'notifications' },
  { id: 'activities', label: 'Recent Activity', path: '/activities', icon: 'history' },
  { id: 'notifications', label: 'Notifications', path: '/notifications', icon: 'notifications_active' },
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

export const Sidebar: React.FC<{ mobileOpen?: boolean; onClose?: () => void }> = ({ mobileOpen = false, onClose }) => {
  const { logout, user } = useAuth();
  const [mobileAdmin, setMobileAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    setMobileAdmin(false);
    if (user) void getMobileAdminConfig().then(() => { if (active) setMobileAdmin(true); }).catch(() => undefined);
    return () => { active = false; };
  }, [user?.id]);
  const { general, status: preferencesStatus } = usePreferences();
  const collapsed = useSidebarCollapsed();
  const compact = collapsed && !mobileOpen;
  const savedName = preferencesStatus === 'ready' ? general.displayName?.trim() : undefined;
  const userLabel = savedName || user?.displayName?.trim() || user?.email || 'Signed-in user';
  const workspaceLabel = preferencesStatus === 'ready' ? general.workspaceName : 'Personal workspace';
  const rememberMode = loadAppearancePreferences().sidebar === 'remember';

  const [counts, setCounts] = useState<{
    domains: number;
    servers: number;
    appsAndWebsites: number;
    providers: number;
    alerts: number;
  }>({
    domains: 0,
    servers: 0,
    appsAndWebsites: 0,
    providers: 0,
    alerts: 0,
  });

  const loadCounts = async () => {
    try {
      const summary = await fetchPortfolioSummary();
      setCounts({
        domains: summary.totalDomains,
        servers: summary.totalServers,
        appsAndWebsites: summary.totalWebsites + summary.totalApps,
        providers: summary.totalProviders,
        alerts: summary.totalAlerts,
      });
    } catch {}
  };

  useEffect(() => {
    void loadCounts();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onPortfolioUpdated = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void loadCounts();
      }, 1000);
    };
    window.addEventListener('domainpulse:portfolio-updated', onPortfolioUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('domainpulse:portfolio-updated', onPortfolioUpdated);
    };
  }, []);

  const navItems = useMemo(() => {
    return BASE_MAIN_NAV_ITEMS.map((item) => {
      if (item.id === 'domains' && counts.domains > 0) {
        return { ...item, badge: counts.domains };
      }
      if (item.id === 'servers' && counts.servers > 0) {
        return { ...item, badge: counts.servers };
      }
      if (item.id === 'websites' && counts.appsAndWebsites > 0) {
        return { ...item, badge: counts.appsAndWebsites };
      }
      if (item.id === 'accounts' && counts.providers > 0) {
        return { ...item, badge: counts.providers };
      }
      if (item.id === 'alerts' && counts.alerts > 0) {
        return { ...item, badge: counts.alerts };
      }
      return item;
    });
  }, [counts]);

  return (
    <aside
      className={`fixed left-0 top-0 h-full text-on-surface z-50 flex flex-col justify-between select-none border-r border-outline-variant shadow-micro transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${
        compact ? 'w-[min(20rem,86vw)] md:w-[4.25rem] bg-surface-container-lowest' : 'w-[min(20rem,86vw)] md:w-sidebar-width bg-surface-container-lowest'
      }`}
      aria-label="Sidebar navigation"
    >
      <div className="flex flex-col min-h-0">
        <div className={`h-header-height flex items-center gap-unit-md border-b border-outline-variant/60 ${compact ? 'justify-center px-0' : 'px-unit-lg'}`}>
          <img
            src="/logo.png"
            alt="DomainPulse"
            className="w-8 h-8 rounded-lg object-cover shadow-micro shrink-0 border border-outline-variant/30"
          />
          {!compact && <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-semibold">DomainPulse</span>}
          {mobileOpen && <button aria-label="Close navigation" className="ml-auto rounded-lg p-1 text-secondary hover:bg-surface-container md:hidden" onClick={onClose} type="button"><span className="material-symbols-outlined">close</span></button>}
        </div>

        {!compact && (
        <div className="px-unit-md pt-unit-sm pb-unit-2xs">
          <div className="flex items-center px-unit-sm py-unit-xs rounded-lg bg-surface-container-low text-secondary border border-outline-variant/60">
            <div className="flex items-center gap-unit-xs min-w-0">
              <span className="material-symbols-outlined text-[18px] text-primary">person</span>
              <span className="font-label-md text-label-md text-on-surface font-medium truncate">{workspaceLabel}</span>
            </div>
          </div>
        </div>
        )}

        <nav className={`flex flex-col gap-unit-2xs mt-unit-xs overflow-y-auto max-h-[calc(100vh-18rem)] py-1 ${compact ? 'px-unit-xs items-center' : 'px-unit-md'}`} aria-label="Main navigation">
          {navItems.map((item) => <SidebarItem key={item.id} item={item} collapsed={compact} onNavigate={onClose} />)}
          {rememberMode && (
            <button
              type="button"
              onClick={() => setSidebarManuallyCollapsed(!readSidebarManuallyCollapsed())}
              aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
              title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
              className="mt-unit-xs w-8 h-8 rounded-lg text-secondary hover:bg-surface-container-low hover:text-on-surface transition-colors shrink-0 flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                {compact ? 'chevron_right' : 'chevron_left'}
              </span>
            </button>
          )}
        </nav>
      </div>

      <div className={`flex flex-col gap-unit-xs pb-unit-md pt-unit-xs border-t border-outline-variant/60 bg-surface-container-lowest shrink-0 ${compact ? 'px-unit-xs items-center' : 'px-unit-md'}`}>
        <nav className={`flex flex-col gap-unit-2xs ${compact ? 'items-center' : ''}`} aria-label="Secondary navigation">
          {mobileAdmin && <SidebarItem item={{ id: 'mobile-admin', label: 'Mobile App Admin', path: '/mobile-admin', icon: 'admin_panel_settings' }} collapsed={compact} onNavigate={onClose} />}
          {BOTTOM_NAV_ITEMS.map((item) => <SidebarItem key={item.id} item={item} collapsed={compact} onNavigate={onClose} />)}
        </nav>

        <div className={`flex items-center rounded-lg bg-surface-container-low mt-unit-xs border border-outline-variant/60 ${compact ? 'flex-col gap-unit-2xs p-unit-xs' : 'justify-between p-unit-sm'}`}>
          <div className="flex items-center gap-unit-sm min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary font-mono text-caption-xs font-semibold shadow-micro">{initialsFor(userLabel)}</div>
            {!compact && (
            <div className="flex flex-col min-w-0">
              <span className="font-label-md text-label-md text-on-surface font-semibold truncate">{userLabel}</span>
              <span className="font-caption-xs text-caption-xs text-secondary truncate">{workspaceLabel}</span>
            </div>
            )}
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
