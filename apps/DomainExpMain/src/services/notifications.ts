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
  assetType: 'domain' | 'server' | 'hosting' | 'ssl' | 'system' | string;
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
    // 1. Configure Android Notification Channels (default & expiry-alerts)
    if (Platform.OS === 'android') {
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
        console.log('Notice: Custom notification channel skipped in Expo Go');
      }
    }

    // 2. Check if running in Expo Go (remote push notifications require a custom development build / standalone APK)
    const isExpoGo =
      (Constants as any)?.appOwnership === 'expo' ||
      (Constants as any)?.executionEnvironment === 'storeClient';

    if (isExpoGo) {
      console.log('Notice: Remote push notification registration skipped in Expo Go (requires development build / standalone APK)');
      return null;
    }

    // 3. Request / check OS permissions
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

    // 4. Resolve EAS project ID
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
      const errMsg = String(tokenErr?.message || '');
      if (errMsg.includes('ExpoApplication') || errMsg.includes('native module')) {
        console.warn('Notice: Push notifications require native ExpoApplication module in development build.');
        return null;
      }
      try {
        const fallbackResult = await Notifications.getExpoPushTokenAsync();
        pushToken = fallbackResult.data;
      } catch (fallbackErr: any) {
        console.log('Notice: Remote push token retrieval via Expo service failed, checking local cache...');
        pushToken = await getItem(STORAGE_KEYS.EXPO_PUSH_TOKEN);
      }
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

export async function getLocalPushNotifications(): Promise<NotificationHistoryItem[]> {
  try {
    const raw = await getItem(STORAGE_KEYS.PUSH_NOTIFICATION_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export async function saveLocalPushNotification(item: NotificationHistoryItem): Promise<void> {
  try {
    const list = await getLocalPushNotifications();
    const filtered = list.filter((p) => p.id !== item.id);
    const updated = [item, ...filtered].slice(0, 100);
    await setItem(STORAGE_KEYS.PUSH_NOTIFICATION_HISTORY, JSON.stringify(updated));
  } catch {}
}

export async function clearAllLocalPushNotifications(): Promise<void> {
  try {
    await setItem(STORAGE_KEYS.PUSH_NOTIFICATION_HISTORY, JSON.stringify([]));
  } catch {}
}

export async function markAllNotificationsAsReadLocal(): Promise<void> {
  try {
    const list = await getLocalPushNotifications();
    const updated = list.map((item) => ({ ...item, isRead: true, readAt: new Date().toISOString() }));
    await setItem(STORAGE_KEYS.PUSH_NOTIFICATION_HISTORY, JSON.stringify(updated));
  } catch {}
}

function notificationToHistoryItem(
  notif: Notifications.Notification,
  isRead = false,
): NotificationHistoryItem {
  const content = notif.request?.content;
  const data = (content?.data as Record<string, any>) || {};
  const id = notif.request?.identifier || `push_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const title = content?.title || data.title || 'Push Notification';
  const body = content?.body || data.body || data.message || '';
  const date = notif.date ? new Date(notif.date).toISOString() : new Date().toISOString();

  return {
    id,
    assetId: String(data.assetId || 'admin_broadcast'),
    assetType: (data.assetType as any) || 'system',
    assetName: String(data.assetName || data.category || 'DomainPulse Alert'),
    expiryDate: date,
    reminderThreshold: typeof data.days === 'number' ? data.days : 0,
    title,
    body,
    status: 'delivered',
    ticketId: null,
    isRead,
    readAt: isRead ? date : null,
    createdAt: date,
  };
}

export async function syncPresentedNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    if (Array.isArray(presented) && presented.length > 0) {
      for (const notif of presented) {
        const item = notificationToHistoryItem(notif, false);
        await saveLocalPushNotification(item);
      }
    }
  } catch {}
}

/**
 * Sets up foreground and tap listeners. Returns subscription cleanup function.
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (data: Record<string, any>) => void,
): () => void {
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    try {
      const item = notificationToHistoryItem(notification, false);
      saveLocalPushNotification(item).catch(() => {});
    } catch {}
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    try {
      if (response?.notification) {
        const item = notificationToHistoryItem(response.notification, true);
        saveLocalPushNotification(item).catch(() => {});
      }
    } catch {}
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
 * Retrieves notification history from local cache and backend.
 */
export async function getNotificationHistory(limit = 50): Promise<NotificationHistoryItem[]> {
  // Sync any active notifications currently sitting in the system tray
  await syncPresentedNotifications().catch(() => {});

  // Fetch local cached push notifications
  const localList = await getLocalPushNotifications();

  // Fetch from server if authenticated
  let serverList: NotificationHistoryItem[] = [];
  try {
    const res = await apiRequest<NotificationHistoryItem[]>(
      `/notifications/history?limit=${limit}`,
      {
        method: 'GET',
      },
    );
    if (Array.isArray(res)) {
      serverList = res;
      for (const item of res) {
        saveLocalPushNotification(item).catch(() => {});
      }
    }
  } catch {}

  // Deduplicate by id and title+body
  const map = new Map<string, NotificationHistoryItem>();
  [...localList, ...serverList].forEach((item) => {
    if (!item) return;
    const key = item.id || `${item.title}_${item.body}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  });

  return Array.from(map.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

/**
 * Marks a notification as read.
 */
export async function markNotificationAsRead(id: string): Promise<boolean> {
  try {
    const list = await getLocalPushNotifications();
    const updated = list.map((item) =>
      item.id === id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item,
    );
    await setItem(STORAGE_KEYS.PUSH_NOTIFICATION_HISTORY, JSON.stringify(updated));
  } catch {}

  const result = await apiRequest<{ ok: boolean }>(`/notifications/history/${id}/read`, {
    method: 'PATCH',
  }).catch(() => null);

  return result?.ok ?? true;
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
        data: { url: '/alerts', days },
      } as any,
      trigger: null,
    });

    const testItem: NotificationHistoryItem = {
      id: `local_test_${Date.now()}`,
      assetId: 'test_notification',
      assetType: 'domain',
      assetName: 'Asset Expiry Monitor',
      expiryDate: new Date().toISOString(),
      reminderThreshold: days,
      title,
      body,
      status: 'delivered',
      ticketId: null,
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    saveLocalPushNotification(testItem).catch(() => {});

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

/**
 * Triggers a real remote test push notification from backend to this device
 */
export async function sendRemoteTestPushNotificationAsync(
  title?: string,
  message?: string,
): Promise<{ ok: boolean; sentCount: number; message?: string }> {
  const result = await apiRequest<{ ok: boolean; sentCount: number; message?: string }>('/notifications/test', {
    method: 'POST',
    body: { title, message },
  });
  if (result?.ok) {
    const testItem: NotificationHistoryItem = {
      id: `remote_test_${Date.now()}`,
      assetId: 'admin_broadcast',
      assetType: 'system',
      assetName: 'Live Cloud Notification Test',
      expiryDate: new Date().toISOString(),
      reminderThreshold: 0,
      title: title || '🔔 DomainPulse Push Notification Test',
      body: message || 'Push notifications are fully working on your mobile device!',
      status: 'delivered',
      ticketId: null,
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    saveLocalPushNotification(testItem).catch(() => {});
  }
  return result;
}
