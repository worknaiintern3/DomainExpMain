import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import { GuestRoute, ProtectedRoute } from './auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { AccountsPage } from './pages/AccountsPage';
import { AlertsPage } from './pages/AlertsPage';
import { DomainDetailPage } from './pages/DomainDetailPage';
import { DomainsPage } from './pages/DomainsPage';
import { FindDomainPage } from './pages/FindDomainPage';
import { InfrastructureMapPage } from './pages/InfrastructureMapPage';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { PricingPage } from './pages/PricingPage';
import { ProviderDetailPage } from './pages/ProviderDetailPage';
import { RegisterPage } from './pages/RegisterPage';
import { ServerDetailPage } from './pages/ServerDetailPage';
import { ServersPage } from './pages/ServersPage';
import { SettingsPage } from './pages/SettingsPage';
import { SupportPage } from './pages/SupportPage';
import { WebsiteDetailPage } from './pages/WebsiteDetailPage';
import { WebsitesPage } from './pages/WebsitesPage';

export const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/domains" element={<DomainsPage />} />
            <Route path="/domains/:domainId" element={<DomainDetailPage />} />
            <Route path="/find-domain" element={<FindDomainPage />} />
            <Route path="/servers" element={<ServersPage />} />
            <Route path="/servers/:serverId" element={<ServerDetailPage />} />
            <Route path="/websites" element={<WebsitesPage />} />
            <Route path="/websites/:websiteId" element={<WebsiteDetailPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/accounts/:accountId" element={<ProviderDetailPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/infrastructure-map" element={<InfrastructureMapPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/help" element={<SupportPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/help-and-support" element={<SupportPage />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
