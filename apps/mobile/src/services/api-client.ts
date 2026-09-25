import { secureStorage } from '../auth/secure-storage';
import { ENV } from '../config/env';

const TOKEN_KEY = 'dp_access_token';
const REFRESH_TOKEN_KEY = 'dp_refresh_token';

export interface MobileApiError {
  status: number;
  message: string;
}

export class MobileApiClient {
  async getAccessToken(): Promise<string | null> {
    return secureStorage.getItem(TOKEN_KEY);
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await secureStorage.setItem(TOKEN_KEY, accessToken);
    await secureStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  async clearTokens(): Promise<void> {
    await secureStorage.removeItem(TOKEN_KEY);
    await secureStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    };

    const url = path.startsWith('http') ? path : `${ENV.API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMsg = 'An error occurred';
      try {
        const errorData = await response.json();
        errorMsg = errorData.detail || errorData.message || response.statusText;
      } catch {
        // Raw text
      }
      throw { status: response.status, message: errorMsg } as MobileApiError;
    }

    return (await response.json()) as T;
  }
}

export const mobileApiClient = new MobileApiClient();
