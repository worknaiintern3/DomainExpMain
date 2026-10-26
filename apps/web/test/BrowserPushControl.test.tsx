import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserPushControl } from '@/features/settings/components/tabs/BrowserPushControl';

const { getWebPushConfig, listWebPushSubscriptions, saveWebPushSubscription, deleteWebPushSubscription } = vi.hoisted(() => ({
  getWebPushConfig: vi.fn(),
  listWebPushSubscriptions: vi.fn(),
  saveWebPushSubscription: vi.fn(),
  deleteWebPushSubscription: vi.fn(),
}));

vi.mock('@/api/web-push', () => ({
  getWebPushConfig,
  listWebPushSubscriptions,
  saveWebPushSubscription,
  deleteWebPushSubscription,
}));

const publicKey = btoa(String.fromCharCode(...Array.from({ length: 65 }, (_, index) => index)));
const endpoint = 'https://fcm.googleapis.com/fcm/send/test';

describe('BrowserPushControl', () => {
  const requestPermission = vi.fn();
  const subscribe = vi.fn();
  const unsubscribe = vi.fn();
  const getSubscription = vi.fn();
  const registration = { pushManager: { getSubscription, subscribe } };

  beforeEach(() => {
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.stubGlobal('Notification', { permission: 'default', requestPermission });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue(registration), register: vi.fn().mockResolvedValue(registration), ready: Promise.resolve(registration) },
    });
    getWebPushConfig.mockReset().mockResolvedValue({ available: true, publicKey });
    listWebPushSubscriptions.mockReset().mockResolvedValue({ endpoints: [] });
    saveWebPushSubscription.mockReset().mockResolvedValue({ enabled: true });
    deleteWebPushSubscription.mockReset().mockResolvedValue(undefined);
    requestPermission.mockReset().mockResolvedValue('granted');
    unsubscribe.mockReset().mockResolvedValue(true);
    getSubscription.mockReset().mockResolvedValue(null);
    subscribe.mockReset().mockResolvedValue({
      endpoint,
      options: { applicationServerKey: null },
      toJSON: () => ({ endpoint, keys: { auth: 'auth-key', p256dh: 'public-key' } }),
      unsubscribe,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('asks permission only after a click and registers the browser subscription', async () => {
    render(<BrowserPushControl />);
    const enable = await screen.findByRole('button', { name: 'Enable browser push' });
    expect(requestPermission).not.toHaveBeenCalled();

    fireEvent.click(enable);
    await waitFor(() => expect(saveWebPushSubscription).toHaveBeenCalledWith({
      endpoint,
      keys: { auth: 'auth-key', p256dh: 'public-key' },
    }));
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/push-sw.js', { scope: '/' });
    expect(screen.getByText('Enabled on this browser.')).toBeInTheDocument();
  });

  it('shows server setup state without querying subscription storage when VAPID is absent', async () => {
    getWebPushConfig.mockResolvedValue({ available: false, publicKey: null });
    listWebPushSubscriptions.mockRejectedValue(new Error('relation does not exist'));
    render(<BrowserPushControl />);

    expect(await screen.findByText('Browser push is not configured on the server yet.')).toBeInTheDocument();
    expect(listWebPushSubscriptions).not.toHaveBeenCalled();
    expect(screen.queryByText('Browser push status unavailable.')).not.toBeInTheDocument();
  });

  it('removes the server endpoint and browser subscription on disable', async () => {
    const existing = {
      endpoint,
      options: { applicationServerKey: null },
      toJSON: () => ({ endpoint, keys: { auth: 'auth-key', p256dh: 'public-key' } }),
      unsubscribe,
    };
    listWebPushSubscriptions.mockResolvedValue({ endpoints: [endpoint] });
    getSubscription.mockResolvedValue(existing);
    render(<BrowserPushControl />);

    fireEvent.click(await screen.findByRole('button', { name: 'Disable on this browser' }));
    await waitFor(() => expect(deleteWebPushSubscription).toHaveBeenCalledWith(endpoint));
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(screen.getByText('Not enabled on this browser.')).toBeInTheDocument();
  });

  it('replaces a subscription made with an older VAPID key', async () => {
    const oldEndpoint = 'https://fcm.googleapis.com/fcm/send/old';
    getSubscription.mockResolvedValue({
      endpoint: oldEndpoint,
      options: { applicationServerKey: new Uint8Array(65).buffer },
      unsubscribe,
    });
    render(<BrowserPushControl />);

    fireEvent.click(await screen.findByRole('button', { name: 'Enable browser push' }));
    await waitFor(() => expect(saveWebPushSubscription).toHaveBeenCalledWith(expect.objectContaining({ endpoint })));
    expect(deleteWebPushSubscription).toHaveBeenCalledWith(oldEndpoint);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledOnce();
  });
});
