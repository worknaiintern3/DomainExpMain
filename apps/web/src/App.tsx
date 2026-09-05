import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';

// Page route components
import { OverviewPage } from './pages/OverviewPage';
import { DomainsPage } from './pages/DomainsPage';
import { DomainDetailPage } from './pages/DomainDetailPage';
import { FindDomainPage } from './pages/FindDomainPage';
import { ServersPage } from './pages/ServersPage';
import { ServerDetailPage } from './pages/ServerDetailPage';
import { WebsitesPage } from './pages/WebsitesPage';
import { WebsiteDetailPage } from './pages/WebsiteDetailPage';
import { AccountsPage } from './pages/AccountsPage';
import { ProviderDetailPage } from './pages/ProviderDetailPage';
import { PricingPage } from './pages/PricingPage';
import { AlertsPage } from './pages/AlertsPage';
import { InfrastructureMapPage } from './pages/InfrastructureMapPage';
import { SettingsPage } from './pages/SettingsPage';
import { SupportPage } from './pages/SupportPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
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
          <Route path="/support" element={<SupportPage />} />
          
          {/* Catch-all route redirects back to overview */}
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
