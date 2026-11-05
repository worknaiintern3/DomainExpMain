import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from '../store/auth-context';
import { ThemeProvider, useTheme } from '../store/theme-context';
import { SettingsProvider } from '../store/settings-context';
import {
  setupNotificationListeners,
  registerForPushNotificationsAsync,
} from '../services/notifications';

import { RemoteConfigProvider, useRemoteConfig } from '../store/remote-config-context';
import { MaintenanceBarrier, UpdateRequiredBarrier } from '../components/AdminBarriers';

// Configure foreground notification behavior at root level
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldPresentAlert: true,
    shouldPresentBadge: true,
    shouldPresentSound: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  } as any),
});

// Configure initial route anchoring for Expo Router
export const unstable_settings = {
  initialRouteName: 'index',
};

// Keep splash screen visible while fonts are loading
SplashScreen.preventAutoHideAsync().catch(() => {});

function NavigationRoot() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const { maintenanceMode, isUpdateRequired } = useRemoteConfig();
  const router = useRouter();

  useEffect(() => {
    // Sync root System UI window background color
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});

    // Sync Android bottom system navigation bar with current light/dark theme
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setStyle(isDark ? 'dark' : 'light');
      } catch {}
    }
  }, [isDark, colors.background]);

  // Push notification setup and deep linking navigation
  useEffect(() => {
    // Ensure standard Android notification channels exist on app launch
    if (Platform.OS === 'android') {
      const setupChannels = async () => {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'General Notifications',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#38bdf8',
            enableLights: true,
            enableVibrate: true,
            showBadge: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: true,
          });
          await Notifications.setNotificationChannelAsync('expiry-alerts', {
            name: 'Asset Expiry Reminders',
            description: 'Notifications for domain, server, hosting, and SSL certificate expiry',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#2563EB',
            enableLights: true,
            enableVibrate: true,
            showBadge: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: true,
          });
        } catch {}
      };
      setupChannels();
    }

    if (isAuthenticated) {
      registerForPushNotificationsAsync().catch(() => {});
    }

    const handleNotificationRoute = (data: Record<string, any>) => {
      try {
        if (data?.route && typeof data.route === 'string') {
          router.push(data.route as any);
        } else if (data?.assetType === 'domain' && data?.assetId) {
          router.push({ pathname: '/domain/[id]', params: { id: String(data.assetId) } });
        } else if (data?.assetType === 'server' && data?.assetId) {
          router.push({ pathname: '/server/[id]', params: { id: String(data.assetId) } });
        } else if (data?.assetType === 'ssl' && data?.assetId) {
          const cleanId = String(data.assetId).replace(/^ssl_/, '');
          router.push({ pathname: '/domain/[id]', params: { id: cleanId } });
        } else {
          router.push('/(tabs)/alerts' as any);
        }
      } catch (err) {
        console.warn('Notification deep link navigation error:', err);
      }
    };

    // Check if app was opened via notification click from killed state
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification?.request?.content?.data) {
        handleNotificationRoute(response.notification.request.content.data);
      }
    }).catch(() => {});

    // Listen for foreground taps or background response
    const cleanup = setupNotificationListeners(
      (_notif) => {
        // Foreground alert received
      },
      (data) => {
        handleNotificationRoute(data);
      },
    );

    return cleanup;
  }, [isAuthenticated, router]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="google-play" options={{ headerShown: false }} />
        <Stack.Screen
          name="activities"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="+not-found"
          options={{
            headerShown: false,
            title: 'Oops!',
          }}
        />
      </Stack>

      {/* Admin Controlled Emergency Kill-Switch Overlay */}
      {maintenanceMode && <MaintenanceBarrier />}

      {/* Admin Controlled Forced Version Update Overlay */}
      {isUpdateRequired && <UpdateRequiredBarrier />}
    </>
  );
}

export default function RootLayout() {
  // Pre-bundle ALL vector icon fonts at startup so Android never downloads them
  // from Metro on-demand — this permanently fixes the "Unable to download Ionicons.ttf" error
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
  });

  const [fallbackReady, setFallbackReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Guaranteed failsafe timer: hide splash screen and mount app within 1.8s
  useEffect(() => {
    const timer = setTimeout(() => {
      setFallbackReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  // Let the native splash screen remain visible over the initial mount until fonts/failsafe are ready
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <SettingsProvider>
            <RemoteConfigProvider>
              <NavigationRoot />
            </RemoteConfigProvider>
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
