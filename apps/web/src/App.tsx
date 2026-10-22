import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import { GuestRoute, ProtectedRoute } from './auth/ProtectedRoute';
import { LandingRedirect } from './preferences/LandingRedirect';
import { PreferencesProvider } from './preferences/PreferencesContext';
import { AppShell } from './components/layout/AppShell';
import { AccountsPage } from './pages/AccountsPage';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { AlertsPage } from './pages/AlertsPage';
import { CloudResourcesPage } from './pages/CloudResourcesPage';
import { DomainDetailPage } from './pages/DomainDetailPage';
import { DomainIntelligencePage } from './pages/DomainIntelligencePage';
import { DomainsPage } from './pages/DomainsPage';
import { FindDomainPage } from './pages/FindDomainPage';
import { GoogleCallbackPage } from './pages/GoogleCallbackPage';
import { GooglePlayPage } from './pages/GooglePlayPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PlayStoreSearchPage } from './pages/PlayStoreSearchPage';
import { InfrastructureMapPage } from './pages/InfrastructureMapPage';
import { LoginPage } from './pages/LoginPage';
import { MobileAdminPage } from './pages/MobileAdminPage';
import { OverviewPage } from './pages/OverviewPage';
import { PricingPage } from './pages/PricingPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProviderDetailPage } from './pages/ProviderDetailPage';
import { RegisterPage } from './pages/RegisterPage';
import { SecurityPage } from './pages/SecurityPage';
import { ServerDetailPage } from './pages/ServerDetailPage';
import { ServersPage } from './pages/ServersPage';
import { SettingsPage } from './pages/SettingsPage';
import { SupportPage } from './pages/SupportPage';
import { WebsiteDetailPage } from './pages/WebsiteDetailPage';
import { WebsitesPage } from './pages/WebsitesPage';

export const App: React.FC = () => (
  <AuthProvider>
    <PreferencesProvider>
    <BrowserRouter>
      <Routes>
        {/* Neither GuestRoute nor ProtectedRoute: this callback serves both
            an unauthenticated Google login return and an authenticated
            Connect-Google return, so it must never be redirected away by
            either wrapper. See GoogleCallbackPage's own comment. */}
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />

        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<LandingRedirect />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/domains" element={<DomainsPage />} />
            <Route path="/domains/:domainId" element={<DomainDetailPage />} />
            <Route path="/find-domain" element={<FindDomainPage />} />
            <Route path="/domain-intelligence" element={<DomainIntelligencePage />} />
            <Route path="/google-play" element={<GooglePlayPage />} />
            <Route path="/play-store" element={<PlayStoreSearchPage />} />
            <Route path="/servers" element={<ServersPage />} />
            <Route path="/servers/:serverId" element={<ServerDetailPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/cloud-resources" element={<CloudResourcesPage />} />
            <Route path="/websites" element={<WebsitesPage />} />
            <Route path="/applications" element={<WebsitesPage />} />
            <Route path="/websites/:websiteId" element={<WebsiteDetailPage />} />
            <Route path="/applications/:websiteId" element={<WebsiteDetailPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/accounts/:accountId" element={<ProviderDetailPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/mobile-admin" element={<MobileAdminPage />} />
            <Route path="/infrastructure-map" element={<InfrastructureMapPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/help" element={<SupportPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/help-and-support" element={<SupportPage />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
    </PreferencesProvider>
  </AuthProvider>
);

export default App;
