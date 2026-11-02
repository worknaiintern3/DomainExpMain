import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AdminLayout } from './components/AdminLayout';
import { ThemeProvider } from './context/ThemeContext';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { MobileAnnouncementsPage } from './pages/MobileAnnouncementsPage';
import { MobileAppearancePage } from './pages/MobileAppearancePage';
import { MobileAuditLogsPage } from './pages/MobileAuditLogsPage';
import { MobileFeatureFlagsPage } from './pages/MobileFeatureFlagsPage';
import { MobileFleetPage } from './pages/MobileFleetPage';
import { MobileHomeLayoutPage } from './pages/MobileHomeLayoutPage';
import { MobileNavigationPage } from './pages/MobileNavigationPage';
import { MobileVersionsPage } from './pages/MobileVersionsPage';
import { PlatformOverviewPage } from './pages/PlatformOverviewPage';
import { UsersManagementPage } from './pages/UsersManagementPage';
import { WebDomainsPage } from './pages/WebDomainsPage';
import { WebServersPage } from './pages/WebServersPage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AdminLayout>
          <Routes>
            {/* Overview */}
            <Route path="/" element={<PlatformOverviewPage />} />

            {/* Users Management (Dedicated Website & Mobile tabs) */}
            <Route path="/users" element={<UsersManagementPage />} />

            {/* Website Platform Management */}
            <Route path="/domains" element={<WebDomainsPage />} />
            <Route path="/servers" element={<WebServersPage />} />

            {/* Mobile Application Management */}
            <Route path="/mobile-fleet" element={<MobileFleetPage />} />
            <Route path="/appearance" element={<MobileAppearancePage />} />
            <Route path="/features" element={<MobileFeatureFlagsPage />} />
            <Route path="/home-layout" element={<MobileHomeLayoutPage />} />
            <Route path="/navigation" element={<MobileNavigationPage />} />
            <Route path="/announcements" element={<MobileAnnouncementsPage />} />
            <Route path="/versions" element={<MobileVersionsPage />} />

            {/* Operations & System */}
            <Route path="/audit-logs" element={<MobileAuditLogsPage />} />
            <Route path="/settings" element={<AdminSettingsPage />} />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AdminLayout>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
