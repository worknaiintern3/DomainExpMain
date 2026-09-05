import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { GlobalHeader } from './GlobalHeader';

export const AppShell: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      {/* Persistent Dark Navy Sidebar (16rem width) */}
      <Sidebar />

      {/* Main Workspace Frame */}
      <div className="pl-sidebar-width flex-1 min-w-0 flex flex-col min-h-screen bg-background">
        {/* Persistent Global Header (3.5rem height) */}
        <GlobalHeader />

        {/* Viewport Outlet for Route Components */}
        <main className="w-full pt-header-height px-unit-xl pb-unit-2xl flex-1 flex flex-col">
          <div className="flex flex-col w-full max-w-[1600px] mx-auto py-unit-lg">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
