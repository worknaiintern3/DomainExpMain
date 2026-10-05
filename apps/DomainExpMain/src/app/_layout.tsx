import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { AuthProvider } from '../store/auth-context';
import { ThemeProvider, useTheme } from '../store/theme-context';
import { SettingsProvider } from '../store/settings-context';

// Keep splash screen visible while fonts are loading
SplashScreen.preventAutoHideAsync().catch(() => {});

function NavigationRoot() {
  const { colors, isDark } = useTheme();

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
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Pre-bundle ALL vector icon fonts at startup so Android never downloads them
  // from Metro on-demand — this permanently fixes the "Unable to download Ionicons.ttf" error
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  // Hold render until fonts are ready
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <SettingsProvider>
            <NavigationRoot />
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
