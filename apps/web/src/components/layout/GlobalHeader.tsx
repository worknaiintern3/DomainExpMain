import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { GlobalSearchModal } from './GlobalSearchModal';

const ROUTE_LABELS: Record<string, string> = {
  '/overview': 'Overview',
  '/domains': 'My Domains',
  '/find-domain': 'Find Domain',
  '/servers': 'VPS & Servers',
  '/websites': 'Websites & Apps',
  '/accounts': 'Accounts & Emails',
  '/pricing': 'Price Comparison',
  '/alerts': 'Alerts & Monitoring',
  '/infrastructure-map': 'Infrastructure Map',
  '/settings': 'Settings',
  '/help': 'Help & Support',
  '/support': 'Help & Support',
  '/help-and-support': 'Help & Support',
};

export const GlobalHeader: React.FC = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();

  // Determine breadcrumb current section
  const currentSection =
    Object.keys(ROUTE_LABELS).find(
      (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path + '/'))
    ) || '/overview';

  const currentTitle = ROUTE_LABELS[currentSection] || 'Overview';

  return (
    <>
      <header
        className="fixed top-0 left-sidebar-width right-0 h-header-height bg-surface/80 backdrop-blur-xl border-b border-outline-variant/40 shadow-micro z-40 px-unit-xl flex items-center justify-between gap-unit-lg"
        aria-label="Application Header"
      >
        {/* Left: Breadcrumbs / Section Context */}
        <div className="flex items-center gap-unit-xs min-w-0">
          <span className="font-caption-xs text-caption-xs text-secondary font-medium select-none">
            DomainPulse
          </span>
          <span className="text-outline-variant text-[13px] select-none">/</span>
          <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
            {currentTitle}
          </span>
        </div>

        {/* Right: Search, Notifications, Profile */}
        <div className="flex items-center gap-unit-md shrink-0">
          {/* Global Search Input Button (Triggers ⌘K Modal) */}
          <div
            onClick={() => setIsSearchOpen(true)}
            className="relative hidden md:flex items-center cursor-pointer w-64 lg:w-72 group"
          >
            <span className="material-symbols-outlined absolute left-unit-sm text-on-surface-variant text-[18px] pointer-events-none group-hover:text-primary transition-colors">
              search
            </span>
            <input
              type="text"
              readOnly
              placeholder="Search domains, servers, websites, emails, IPs..."
              className="h-9 w-full pl-9 pr-12 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm border border-outline-variant/60 shadow-micro placeholder:text-outline cursor-pointer group-hover:border-primary/50 transition-all focus:outline-none"
            />
            <span className="absolute right-2 font-caption-xs text-[10px] text-on-surface-variant px-1.5 py-0.5 rounded bg-surface-container font-mono border border-outline-variant/40">
              ⌘K
            </span>
          </div>

          {/* Mobile Search Trigger Icon */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors border border-outline-variant/60 shadow-micro"
            aria-label="Open search"
          >
            <span className="material-symbols-outlined text-[20px]">search</span>
          </button>

          {/* Notifications Trigger */}
          <Link
            to="/alerts"
            className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors border border-outline-variant/60 shadow-micro group"
            title="Alerts & Notifications"
          >
            <span className="material-symbols-outlined text-[20px] group-hover:text-primary transition-colors">
              notifications
            </span>
            {/* Unread dot */}
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-surface-container-lowest" />
          </Link>

          {/* User Profile Avatar */}
          <div
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-mono text-caption-xs font-semibold shadow-sm cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all select-none"
            title="Aman Developer — Portfolio Workspace"
          >
            AD
          </div>
        </div>
      </header>

      {/* Global ⌘K Search Modal */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
