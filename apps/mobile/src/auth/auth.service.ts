import { mobileApiClient } from '../services/api-client';

export interface MobileUser {
  id: string;
  email: string;
  displayName: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: MobileUser;
}

export const authService = {
  async login(email: string, password: string): Promise<MobileUser> {
    const data = await mobileApiClient.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    await mobileApiClient.setTokens(data.accessToken, data.refreshToken);
    return data.user;
  },

  async logout(): Promise<void> {
    try {
      await mobileApiClient.request('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      await mobileApiClient.clearTokens();
    }
  },

  async getMe(): Promise<MobileUser | null> {
    const token = await mobileApiClient.getAccessToken();
    if (!token) return null;

    try {
      const data = await mobileApiClient.request<{ user: MobileUser }>('/auth/me');
      return data.user;
    } catch {
      await mobileApiClient.clearTokens();
      return null;
    }
  },
};
