self.addEventListener('push', (event) => {
  if (!event.data) return;
  event.waitUntil((async () => {
    let payload;
    try { payload = event.data.json(); } catch { return; }
    if (typeof payload.title !== 'string' || typeof payload.body !== 'string') return;
    await self.registration.showNotification(payload.title.slice(0, 120), {
      body: payload.body.slice(0, 220),
      tag: typeof payload.alertId === 'string' ? payload.alertId : undefined,
      data: { url: '/alerts' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL('/alerts', self.location.origin);
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (open) {
      await open.focus();
      if ('navigate' in open) await open.navigate(url.href);
    } else {
      await clients.openWindow(url.href);
    }
  })());
});
