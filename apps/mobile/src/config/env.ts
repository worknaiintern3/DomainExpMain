export const ENV = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  APP_VERSION: '1.0.0',
  PLATFORM: 'all',
} as const;
