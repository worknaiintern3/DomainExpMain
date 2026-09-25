import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AdminLayout } from './components/AdminLayout';
import { MobileAnnouncementsPage } from './pages/MobileAnnouncementsPage';
import { MobileAppearancePage } from './pages/MobileAppearancePage';
import { MobileAuditLogsPage } from './pages/MobileAuditLogsPage';
import { MobileDashboardPage } from './pages/MobileDashboardPage';
import { MobileFeatureFlagsPage } from './pages/MobileFeatureFlagsPage';
import { MobileHomeLayoutPage } from './pages/MobileHomeLayoutPage';
import { MobileNavigationPage } from './pages/MobileNavigationPage';
import { MobileVersionsPage } from './pages/MobileVersionsPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AdminLayout>
        <Routes>
          <Route path="/" element={<MobileDashboardPage />} />
          <Route path="/appearance" element={<MobileAppearancePage />} />
          <Route path="/features" element={<MobileFeatureFlagsPage />} />
          <Route path="/home-layout" element={<MobileHomeLayoutPage />} />
          <Route path="/navigation" element={<MobileNavigationPage />} />
          <Route path="/announcements" element={<MobileAnnouncementsPage />} />
          <Route path="/versions" element={<MobileVersionsPage />} />
          <Route path="/audit-logs" element={<MobileAuditLogsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminLayout>
    </BrowserRouter>
  );
};

export default App;
