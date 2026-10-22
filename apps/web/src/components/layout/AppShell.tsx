import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { GlobalHeader } from './GlobalHeader';
import { useSidebarCollapsed } from '@/lib/appearance';

export const AppShell: React.FC = () => {
  const sidebarCollapsed = useSidebarCollapsed();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      {mobileMenuOpen && <button className="fixed inset-0 z-[45] bg-slate-950/55 md:hidden" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} type="button" />}
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Workspace Frame */}
      <div className={`flex-1 min-w-0 flex flex-col min-h-screen bg-background ${sidebarCollapsed ? 'md:pl-[4.25rem]' : 'md:pl-sidebar-width'}`}>
        {/* Persistent Global Header (3.5rem height) */}
        <GlobalHeader sidebarCollapsed={sidebarCollapsed} onOpenMenu={() => setMobileMenuOpen(true)} />

        {/* Viewport Outlet for Route Components */}
        <main className="w-full pt-header-height px-unit-md sm:px-unit-xl pb-unit-2xl flex-1 flex flex-col">
          <div className="flex flex-col w-full max-w-screen-2xl mx-auto py-unit-lg">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
