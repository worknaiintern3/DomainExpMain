import React, { useEffect, useState } from 'react';

import {
  deleteWebPushSubscription,
  getWebPushConfig,
  listWebPushSubscriptions,
  saveWebPushSubscription,
  type WebPushConfig,
} from '@/api/web-push';

type PushStatus = 'loading' | 'unsupported' | 'unconfigured' | 'blocked' | 'enabled' | 'disabled' | 'error';

function isSupported(): boolean {
  return window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

function applicationServerKey(key: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - key.length % 4) % 4);
  const decoded = atob((key + padding).replace(/-/gu, '+').replace(/_/gu, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let i = 0; i < decoded.length; i += 1) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

function matchesApplicationServerKey(subscription: PushSubscription, publicKey: string): boolean {
  const existing = subscription.options.applicationServerKey;
  if (!existing) return true;
  const expected = applicationServerKey(publicKey);
  const actual = new Uint8Array(existing);
  return actual.length === expected.length && actual.every((byte, index) => byte === expected[index]);
}

export const BrowserPushControl: React.FC = () => {
  const [config, setConfig] = useState<WebPushConfig | null>(null);
  const [status, setStatus] = useState<PushStatus>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!isSupported()) {
        if (mounted) setStatus('unsupported');
        return;
      }
      try {
        const nextConfig = await getWebPushConfig();
        if (!mounted) return;
        setConfig(nextConfig);
        if (!nextConfig.available || !nextConfig.publicKey) {
          setStatus('unconfigured');
          return;
        }
        const saved = await listWebPushSubscriptions();
        if (!mounted) return;
        if (Notification.permission === 'denied') {
          setStatus('blocked');
          return;
        }
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager.getSubscription();
        if (mounted) setStatus(subscription && saved.endpoints.includes(subscription.endpoint) ? 'enabled' : 'disabled');
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Browser push status could not be loaded.');
          setStatus('error');
        }
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const enable = async () => {
    if (!config?.publicKey || busy) return;
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'blocked' : 'disabled');
        return;
      }
      const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !matchesApplicationServerKey(subscription, config.publicKey)) {
        await deleteWebPushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
        subscription = null;
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(config.publicKey),
        });
      }
      const serialized = subscription.toJSON();
      if (!serialized.endpoint || !serialized.keys?.auth || !serialized.keys.p256dh) {
        throw new Error('This browser returned an incomplete push subscription.');
      }
      await saveWebPushSubscription({ endpoint: serialized.endpoint, keys: { auth: serialized.keys.auth, p256dh: serialized.keys.p256dh } });
      setStatus('enabled');
    } catch (enableError) {
      setError(enableError instanceof Error ? enableError.message : 'Could not enable browser push.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await deleteWebPushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus('disabled');
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : 'Could not disable browser push.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-unit-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-label-md text-label-md font-semibold text-on-surface">Browser push</p>
          <p className="mt-1 text-body-sm text-secondary">
            Get a notification on this browser when a new monitoring alert opens, even if the app tab is closed.
          </p>
        </div>
        {status === 'enabled' && <button type="button" disabled={busy} onClick={() => void disable()} className="h-9 rounded-lg border border-outline-variant px-unit-md text-label-md disabled:opacity-50">{busy ? 'Disabling…' : 'Disable on this browser'}</button>}
        {status === 'disabled' && <button type="button" disabled={busy} onClick={() => void enable()} className="h-9 rounded-lg bg-primary px-unit-md text-label-md text-on-primary disabled:opacity-50">{busy ? 'Enabling…' : 'Enable browser push'}</button>}
      </div>
      <p className="mt-2 text-caption-xs text-secondary" role="status">
        {status === 'loading' && 'Checking browser push…'}
        {status === 'enabled' && 'Enabled on this browser.'}
        {status === 'disabled' && 'Not enabled on this browser.'}
        {status === 'unsupported' && 'Browser push needs a supported browser and HTTPS (localhost works for development).'}
        {status === 'unconfigured' && 'Browser push is not configured on the server yet.'}
        {status === 'blocked' && 'Notification permission is blocked. Allow it in your browser site settings.'}
        {status === 'error' && 'Browser push status unavailable.'}
      </p>
      {error && <p className="mt-2 text-body-sm text-error" role="alert">{error}</p>}
    </div>
  );
};
