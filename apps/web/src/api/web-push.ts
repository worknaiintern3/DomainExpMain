import { ApiError, apiRequest } from './client';

export interface WebPushConfig {
  available: boolean;
  publicKey: string | null;
}

export async function getWebPushConfig(): Promise<WebPushConfig> {
  try {
    return await apiRequest<WebPushConfig>('/web-push/config');
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { available: false, publicKey: null };
    }
    throw error;
  }
}

export function listWebPushSubscriptions(): Promise<{ endpoints: string[] }> {
  return apiRequest<{ endpoints: string[] }>('/web-push/subscriptions');
}

export function saveWebPushSubscription(subscription: { endpoint: string; keys: { auth: string; p256dh: string } }): Promise<{ enabled: boolean }> {
  return apiRequest<{ enabled: boolean }>('/web-push/subscriptions', { body: subscription, method: 'POST' });
}

export function deleteWebPushSubscription(endpoint: string): Promise<void> {
  return apiRequest<void>('/web-push/subscriptions', { body: { endpoint }, method: 'DELETE' });
}
