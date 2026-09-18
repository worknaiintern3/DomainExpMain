import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';
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

function initialsFor(label: string): string {
  return label
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'DP';
}

export const GlobalHeader: React.FC = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen((isOpen) => !isOpen);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const currentSection = Object.keys(ROUTE_LABELS).find(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`),
  ) ?? '/overview';
  const userLabel = user?.displayName?.trim() || user?.email || 'Signed-in user';

  return (
    <>
      <header
        className="fixed top-0 left-sidebar-width right-0 h-header-height bg-surface-container-lowest/90 backdrop-blur-xl border-b border-outline-variant shadow-micro z-40 px-unit-xl flex items-center justify-between gap-unit-lg"
        aria-label="Application header"
      >
        <div className="flex items-center gap-unit-xs min-w-0">
          <span className="font-caption-xs text-caption-xs text-secondary font-medium select-none">DomainPulse</span>
          <span className="text-outline-variant text-[13px] select-none">/</span>
          <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
            {ROUTE_LABELS[currentSection] ?? 'Overview'}
          </span>
        </div>

        <div className="flex items-center gap-unit-md shrink-0">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="relative hidden md:flex items-center cursor-pointer w-64 lg:w-72 group text-left"
            aria-label="Open quick navigation"
          >
            <span className="material-symbols-outlined absolute left-unit-sm text-secondary text-[18px] pointer-events-none group-hover:text-primary transition-colors">search</span>
            <span className="h-9 w-full pl-9 pr-12 rounded-lg bg-surface-container-low text-secondary font-body-sm text-body-sm border border-outline-variant shadow-micro group-hover:border-primary/50 group-hover:bg-surface-container-lowest transition-all flex items-center">
              Navigate to a view…
            </span>
            <span className="absolute right-2 font-caption-xs text-[10px] text-secondary px-1.5 py-0.5 rounded bg-surface-container font-mono border border-outline-variant">Ctrl K</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-low text-secondary hover:bg-surface-container hover:text-on-surface transition-colors border border-outline-variant shadow-micro"
            aria-label="Open quick navigation"
          >
            <span className="material-symbols-outlined text-[20px]">search</span>
          </button>

          <Link
            to="/alerts"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-low text-secondary hover:bg-surface-container hover:text-on-surface transition-colors border border-outline-variant shadow-micro group"
            title="Alerts and monitoring preview"
            aria-label="Open alerts and monitoring preview"
          >
            <span className="material-symbols-outlined text-[20px] group-hover:text-primary transition-colors">notifications</span>
          </Link>

          <div
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-mono text-caption-xs font-semibold shadow-micro select-none"
            title={`${userLabel} — Personal workspace`}
            aria-label={userLabel}
          >
            {initialsFor(userLabel)}
          </div>
        </div>
      </header>

      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
