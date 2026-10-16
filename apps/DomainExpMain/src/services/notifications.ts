import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { apiRequest } from './api';
import { getItem, setItem, deleteItem, STORAGE_KEYS } from './storage';

// Configure foreground notification behavior
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
  } as any),
});

export interface NotificationPreferences {
  id?: string;
  userId?: string;
  workspaceId?: string;
  pushEnabled: boolean;
  reminderThresholds: number[];
  notifyDomains: boolean;
  notifyServers: boolean;
  notifyHosting: boolean;
  notifySsl: boolean;
  timeZone: string;
  preferredHour: number;
}

export interface NotificationHistoryItem {
  id: string;
  assetId: string;
  assetType: 'domain' | 'server' | 'hosting' | 'ssl';
  assetName: string;
  expiryDate: string;
  reminderThreshold: number;
  title: string;
  body: string;
  status: string;
  ticketId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

/**
 * Registers the device for Expo Push Notifications, sets up channels,
 * and saves the token to the backend.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    // 1. Configure Android Notification Channel (supported in standalone APK/AAB builds)
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('expiry-alerts', {
          name: 'Asset Expiry Reminders',
          description: 'Notifications for domain, server, hosting, and SSL certificate expiry',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563EB',
          sound: 'default',
          showBadge: true,
        });
      } catch (channelErr: any) {
        // In Expo Go client, custom channels are unavailable; handled automatically in standalone builds.
        console.log('Notice: Custom notification channel skipped in Expo Go');
      }
    }

    // 2. Request / check OS permissions
    const permissions: any = await Notifications.getPermissionsAsync();
    let isGranted = Boolean(permissions?.granted || permissions?.status === 'granted');

    if (!isGranted) {
      const requested: any = await Notifications.requestPermissionsAsync();
      isGranted = Boolean(requested?.granted || requested?.status === 'granted');
    }

    if (!isGranted) {
      console.log('Push notification permissions denied by user.');
      return null;
    }

    // 3. Resolve EAS project ID
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId ??
      'a17e35d7-b48f-4816-8485-18119bd4f7c4';

    let pushToken: string | null = null;
    try {
      const tokenResult = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      pushToken = tokenResult.data;
    } catch (tokenErr: any) {
      console.log('Notice: Remote push token registration requires standalone APK or production build (Expo Go on Android disables remote push).');
    }

    if (!pushToken) {
      return null;
    }

    // Store push token locally
    await setItem(STORAGE_KEYS.EXPO_PUSH_TOKEN, pushToken);

    // 4. Send token to backend
    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    const deviceName = Device.modelName ?? Device.deviceName ?? `${Platform.OS} device`;
    const appVersion = Constants?.expoConfig?.version ?? '1.0.0';

    await apiRequest('/notifications/devices', {
      method: 'POST',
      body: {
        expoPushToken: pushToken,
        platform,
        deviceName,
        appVersion,
      },
    });

    console.log(`Push notifications registered successfully. Token: ${pushToken.slice(0, 15)}...`);
    return pushToken;
  } catch (error) {
    console.warn('Failed to register for push notifications:', error);
    return null;
  }
}

/**
 * Unregisters the device push token upon user logout.
 */
export async function unregisterPushNotificationsAsync(): Promise<void> {
  try {
    const token = await getItem(STORAGE_KEYS.EXPO_PUSH_TOKEN);
    if (token) {
      await apiRequest(`/notifications/devices/${encodeURIComponent(token)}`, {
        method: 'DELETE',
      }).catch(() => {});
      await deleteItem(STORAGE_KEYS.EXPO_PUSH_TOKEN);
    }
  } catch (err) {
    console.warn('Error during push unregistration:', err);
  }
}

/**
 * Sets up foreground and tap listeners. Returns subscription cleanup function.
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (data: Record<string, any>) => void,
): () => void {
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (onNotificationTapped && data) {
      onNotificationTapped(data);
    }
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Fetches user notification preferences from the backend.
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const result = await apiRequest<NotificationPreferences>('/notifications/preferences', {
    method: 'GET',
  });
  return result;
}

/**
 * Updates user notification preferences on the backend.
 */
export async function updateNotificationPreferences(
  updates: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const result = await apiRequest<NotificationPreferences>('/notifications/preferences', {
    method: 'PATCH',
    body: updates,
  });
  return result;
}

/**
 * Retrieves notification history from the backend.
 */
export async function getNotificationHistory(limit = 50): Promise<NotificationHistoryItem[]> {
  const result = await apiRequest<NotificationHistoryItem[]>(
    `/notifications/history?limit=${limit}`,
    {
      method: 'GET',
    },
  );
  return result ?? [];
}

/**
 * Marks a notification as read.
 */
export async function markNotificationAsRead(id: string): Promise<boolean> {
  const result = await apiRequest<{ ok: boolean }>(`/notifications/history/${id}/read`, {
    method: 'PATCH',
  });
  return result?.ok ?? false;
}

/**
 * Triggers an expiry check simulation (e.g. 15, 7, 3, 1, or 0 days remaining)
 * for testing push notifications without altering production database records.
 */
export async function triggerExpirySimulation(
  simulatedDaysRemaining?: number,
  dryRun = false,
): Promise<any> {
  const result = await apiRequest('/notifications/trigger-check', {
    method: 'POST',
    body: {
      simulatedDaysRemaining,
      dryRun,
    },
  });
  return result;
}

/**
 * Fires an immediate local notification banner on the device
 * (Guarantees instant banner pop-up in Expo Go, dev builds, and production).
 */
export async function sendLocalTestNotificationAsync(days: number): Promise<{
  success: boolean;
  permissionGranted: boolean;
  title: string;
  body: string;
  error?: string;
}> {
  const title =
    days === 0
      ? '🚨 URGENT: Asset Expiring Today!'
      : `⚠️ Expiry Warning: ${days} Days Remaining`;
  const body =
    days === 0
      ? 'domainpulse.org expires today! Renew immediately to prevent DNS suspension.'
      : `domainpulse.org will expire in ${days} days. Tap to review renewal options.`;

  if (Platform.OS === 'web') {
    return { success: true, permissionGranted: true, title, body };
  }

  try {
    // 1. Ensure permission is requested and granted
    let permissions: any = await Notifications.getPermissionsAsync();
    let isGranted = Boolean(permissions?.granted || permissions?.status === 'granted');

    if (!isGranted) {
      const requested: any = await Notifications.requestPermissionsAsync();
      isGranted = Boolean(requested?.granted || requested?.status === 'granted');
    }

    // 2. Configure Android Notification Channel with highest priority (standalone APK/AAB)
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('expiry-alerts', {
          name: 'Asset Expiry Reminders',
          description: 'Expiry reminders for domains, servers, SSL certificates and hosting',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563EB',
          sound: 'default',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });
      } catch (channelErr: any) {
        // Fallback in Expo Go
      }
    }

    // 3. Schedule notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        channelId: 'expiry-alerts',
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { url: '/(tabs)/alerts', days },
      } as any,
      trigger: null,
    });

    return {
      success: true,
      permissionGranted: isGranted,
      title,
      body,
    };
  } catch (err: any) {
    console.warn('Local test notification notice:', err);
    return {
      success: false,
      permissionGranted: false,
      title,
      body,
      error: err?.message || String(err),
    };
  }
}

