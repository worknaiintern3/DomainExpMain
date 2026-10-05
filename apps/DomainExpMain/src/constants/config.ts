import { Platform } from 'react-native';

const getInitialApiUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:4000/api/v1`;
    }
    return 'http://localhost:4000/api/v1';
  }
  // Host machine WiFi IP on Windows for mobile devices/emulators
  return 'http://192.168.1.47:4000/api/v1';
};

export const API_CONFIG = {
  DEFAULT_API_URL: getInitialApiUrl(),
  FALLBACK_LOCALHOST: 'http://localhost:4000/api/v1',
  WIFI_IP_URL: 'http://192.168.1.47:4000/api/v1',
  ANDROID_EMULATOR_URL: 'http://10.0.2.2:4000/api/v1',
  TIMEOUT_MS: 12000,
  APP_NAME: 'DomainPulse',
  VERSION: '1.0.0',
  RATE_LIMIT: {
    MAX_REQUESTS: 5000,
    WINDOW_MINUTES: 15,
    WINDOW_MS: 15 * 60 * 1000,
  },
};

export const SUPPORTED_TLDS = [
  '.com',
  '.in',
  '.co.in',
  '.ai',
  '.io',
  '.org',
  '.net',
  '.co',
  '.tech',
  '.app',
  '.dev',
  '.xyz',
] as const;

export type SupportedTld = (typeof SUPPORTED_TLDS)[number];
