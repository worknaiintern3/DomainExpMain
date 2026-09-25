import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { registerRootComponent } from 'expo';
import type { MobileBootstrapConfigResponse } from '@domainpulse/contracts';

import { AuthProvider, useAuth } from './src/auth/auth.context';
import { ConfigurableHomeScreen } from './src/components/ConfigurableHomeScreen';
import { MaintenanceNotice } from './src/components/MaintenanceNotice';
import { AddDomainModal, QuickActionModal } from './src/components/common';
import { DEFAULT_MOBILE_CONFIG } from './src/config/default-config';
import { remoteConfigService } from './src/config/remote-config.service';
import { ConfigurableNavigation } from './src/navigation/ConfigurableNavigation';
import { AlertsScreen } from './src/screens/AlertsScreen';
import { DomainDetailScreen } from './src/screens/DomainDetailScreen';
import { DomainFinderScreen } from './src/screens/DomainFinderScreen';
import { DomainsScreen } from './src/screens/DomainsScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { ProvidersScreen } from './src/screens/ProvidersScreen';
import { ServersScreen } from './src/screens/ServersScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SplashScreen } from './src/screens/SplashScreen';
import { WebsitesScreen } from './src/screens/WebsitesScreen';
import { colors } from './src/theme';

type SubScreen =
  | 'domain-detail'
  | 'finder'
  | 'servers'
  | 'websites'
  | 'providers'
  | 'settings'
  | null;

const MainContent: React.FC<{
  config: MobileBootstrapConfigResponse;
}> = ({ config }) => {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [guestMode, setGuestMode] = useState(false);
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [subScreen, setSubScreen] = useState<SubScreen>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [quickActionModalVisible, setQuickActionModalVisible] = useState(false);
  const [addDomainModalVisible, setAddDomainModalVisible] = useState(false);

  // Authentication check: show Login if not logged in and not guest
  if (authLoading) {
    return <SplashScreen appName={config.app.appName} statusText="Verifying session..." />;
  }

  if (!user && !guestMode) {
    return (
      <LoginScreen
        onSuccess={() => {}}
        onSkip={() => setGuestMode(true)}
      />
    );
  }

  const handleQuickAction = (actionId: string) => {
    setQuickActionModalVisible(false);
    switch (actionId) {
      case 'add-domain':
        setSubScreen(null);
        setCurrentTab('domains');
        setAddDomainModalVisible(true);
        break;
      case 'domain-finder':
        setSubScreen('finder');
        break;
      case 'add-server':
        setSubScreen('servers');
        break;
      case 'scan-ssl':
        setSubScreen(null);
        setCurrentTab('domains');
        break;
      case 'add-provider':
        setSubScreen('providers');
        break;
      default:
        break;
    }
  };

  const handleSelectDomain = (domainId: string) => {
    setSelectedDomainId(domainId);
    setSubScreen('domain-detail');
  };

  const renderSubScreen = () => {
    switch (subScreen) {
      case 'domain-detail':
        return selectedDomainId ? (
          <DomainDetailScreen
            domainId={selectedDomainId}
            onBack={() => setSubScreen(null)}
          />
        ) : null;
      case 'finder':
        return <DomainFinderScreen onBack={() => setSubScreen(null)} />;
      case 'servers':
        return <ServersScreen onBack={() => setSubScreen(null)} />;
      case 'websites':
        return <WebsitesScreen onBack={() => setSubScreen(null)} />;
      case 'providers':
        return <ProvidersScreen onBack={() => setSubScreen(null)} />;
      case 'settings':
        return <SettingsScreen onBack={() => setSubScreen(null)} config={config} />;
      default:
        return null;
    }
  };

  const renderTabScreen = () => {
    switch (currentTab) {
      case 'home':
        return (
          <ConfigurableHomeScreen
            config={config}
            onQuickAction={handleQuickAction}
            onNavigate={(screen) => setSubScreen(screen as SubScreen)}
            onSelectDomain={handleSelectDomain}
          />
        );
      case 'domains':
        return (
          <DomainsScreen
            onSelectDomain={handleSelectDomain}
          />
        );
      case 'alerts':
        return <AlertsScreen />;
      case 'more':
        return (
          <MoreScreen
            user={user}
            onNavigate={(screen) => setSubScreen(screen as SubScreen)}
            onSignOut={async () => {
              setGuestMode(false);
              await logout();
            }}
            configVersion={config.version.latestVersion}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            onBack={() => setCurrentTab('home')}
            config={config}
          />
        );
      default:
        return (
          <ConfigurableHomeScreen
            config={config}
            onQuickAction={handleQuickAction}
            onNavigate={(screen) => setSubScreen(screen as SubScreen)}
            onSelectDomain={handleSelectDomain}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Active Screen Area */}
      <View style={styles.screenWrapper}>
        {subScreen ? renderSubScreen() : renderTabScreen()}
      </View>

      {/* Persistent Bottom Bar (Visible on primary tabs) */}
      {!subScreen ? (
        <ConfigurableNavigation
          items={config.navigation}
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setSubScreen(null);
            setCurrentTab(tab);
          }}
          onOpenQuickActions={() => setQuickActionModalVisible(true)}
          primaryColor={config.app.primaryColor || colors.neonCyan}
        />
      ) : null}

      {/* Center Floating Action Button Drawer */}
      <QuickActionModal
        visible={quickActionModalVisible}
        onClose={() => setQuickActionModalVisible(false)}
        onSelectAction={handleQuickAction}
      />

      {/* Quick Action Add Domain Modal */}
      <AddDomainModal
        visible={addDomainModalVisible}
        onClose={() => setAddDomainModalVisible(false)}
        onSuccess={(saved) => {
          if (saved?.id) {
            handleSelectDomain(saved.id);
          }
        }}
      />
    </View>
  );
};

export default function App() {
  const [config, setConfig] = useState<MobileBootstrapConfigResponse>(DEFAULT_MOBILE_CONFIG);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    remoteConfigService
      .init()
      .then((loaded) => {
        if (isMounted) {
          setConfig(loaded);
        }
      })
      .catch(() => {
        // Fallback already assigned in initial state
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return <SplashScreen appName="DomainPulse" statusText="Initializing remote services..." />;
  }

  // Remote maintenance mode interceptor
  if (config.app.maintenanceMode) {
    return (
      <MaintenanceNotice
        appName={config.app.appName}
        message={config.app.maintenanceMessage ?? null}
      />
    );
  }

  return (
    <AuthProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bgPrimary} />
        <MainContent config={config} />
      </SafeAreaView>
    </AuthProvider>
  );
}

registerRootComponent(App);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  screenWrapper: {
    flex: 1,
  },
});
