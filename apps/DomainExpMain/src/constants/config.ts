import { Platform } from 'react-native';

const PRODUCTION_API_URL = 'https://app.domainexp.info/api/v1';
const LOCAL_BACKEND_URL = 'http://192.168.1.39:4000/api/v1';

const getInitialApiUrl = (): string => {
  // 1. Explicitly configured via environment variable
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // 2. Production release build
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return PRODUCTION_API_URL;
  }
  // 3. Web environment
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:4000/api/v1';
      }
      return `http://${window.location.hostname}:4000/api/v1`;
    }
    return 'http://localhost:4000/api/v1';
  }
  // 4. Default to live production URL
  return PRODUCTION_API_URL;
};

export const API_CONFIG = {
  DEFAULT_API_URL: getInitialApiUrl(),
  PRODUCTION_API_URL: PRODUCTION_API_URL,
  FALLBACK_LOCALHOST: 'http://localhost:4000/api/v1',
  WIFI_IP_URL: 'http://192.168.1.39:4000/api/v1',
  ANDROID_EMULATOR_URL: 'http://10.0.2.2:4000/api/v1',
  TIMEOUT_MS: 15000,
  APP_NAME: 'DomainPulse',
  VERSION: '1.0.1',
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
