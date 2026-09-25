import type { MobileBootstrapConfigResponse } from '@domainpulse/contracts';

export const DEFAULT_MOBILE_CONFIG: MobileBootstrapConfigResponse = {
  app: {
    appName: 'DomainPulse',
    logoUrl: null,
    primaryColor: '#2563EB',
    secondaryColor: '#1E293B',
    maintenanceMode: false,
    maintenanceMessage: null,
  },
  features: {
    domains: true,
    servers: true,
    websites: true,
    alerts: true,
    providers: true,
    infrastructureMap: true,
    aiDomainFinder: true,
  },
  featureFlags: [
    { key: 'domains', name: 'Domains', description: 'Domain Portfolio Management', enabled: true, minAppVersion: null },
    { key: 'servers', name: 'Servers', description: 'Infrastructure & VPS Tracking', enabled: true, minAppVersion: null },
    { key: 'websites', name: 'Websites', description: 'Web Applications', enabled: true, minAppVersion: null },
    { key: 'alerts', name: 'Alerts', description: 'Domain & SSL Expiry Alerts', enabled: true, minAppVersion: null },
    { key: 'providers', name: 'Providers', description: 'Connected Registrar Accounts', enabled: true, minAppVersion: null },
    { key: 'infrastructureMap', name: 'Infrastructure Map', description: 'Full Visual Graph', enabled: true, minAppVersion: null },
    { key: 'aiDomainFinder', name: 'AI Domain Finder', description: 'Smart Search & Suggestions', enabled: true, minAppVersion: null },
  ],
  navigation: [
    { key: 'home', label: 'Home', icon: 'home', route: '/home', sortOrder: 1, enabled: true, badge: null },
    { key: 'domains', label: 'Domains', icon: 'globe', route: '/domains', sortOrder: 2, enabled: true, badge: null },
    { key: 'alerts', label: 'Alerts', icon: 'bell', route: '/alerts', sortOrder: 3, enabled: true, badge: null },
    { key: 'settings', label: 'Settings', icon: 'settings', route: '/settings', sortOrder: 4, enabled: true, badge: null },
  ],
  homeSections: [
    { sectionKey: 'banner', title: 'Announcements', sortOrder: 1, enabled: true, configJson: null },
    { sectionKey: 'stats', title: 'Portfolio Overview', sortOrder: 2, enabled: true, configJson: null },
    { sectionKey: 'quickActions', title: 'Quick Actions', sortOrder: 3, enabled: true, configJson: null },
    { sectionKey: 'alerts', title: 'Urgent Alerts', sortOrder: 4, enabled: true, configJson: null },
    { sectionKey: 'domains', title: 'Expiring Domains', sortOrder: 5, enabled: true, configJson: null },
    { sectionKey: 'servers', title: 'Active Servers', sortOrder: 6, enabled: true, configJson: null },
  ],
  version: {
    platform: 'all',
    minimumVersion: '1.0.0',
    latestVersion: '1.0.0',
    forceUpdate: false,
    updateUrl: null,
    releaseNotes: 'Welcome to DomainPulse Mobile',
  },
  announcements: [],
};
