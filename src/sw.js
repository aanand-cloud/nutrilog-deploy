import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly } from 'workbox-strategies';

/**
 * Never precache HTML — pull-to-refresh / post-deploy navigations must get
 * fresh index.html. Stale HTML pointing at deleted hashed chunks is what
 * blanks the app (especially when the host SPA-rewrites missing assets to HTML).
 */
const manifest = (self.__WB_MANIFEST || []).filter((entry) => {
  const url = typeof entry === 'string' ? entry : entry?.url;
  return url !== 'index.html' && url !== '/index.html';
});

precacheAndRoute(manifest);
cleanupOutdatedCaches();

registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());

registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'pages-v1',
      networkTimeoutSeconds: 4,
    }),
    {
      denylist: [/^\/api\//, /^\/assets\//, /^\/icons\//],
    }
  )
);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop any legacy HTML shells that used to live in the precache.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.includes('pages-') === false && k.includes('precache'))
          .map(async (key) => {
            const cache = await caches.open(key);
            const reqs = await cache.keys();
            await Promise.all(
              reqs
                .filter((req) => {
                  const path = new URL(req.url).pathname;
                  return path === '/' || path.endsWith('/index.html') || path === '/index.html';
                })
                .map((req) => cache.delete(req))
            );
          })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data?.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

self.addEventListener('push', (event) => {
  let payload = { title: 'MealNova', body: 'You have a nutrition update.', url: '/?view=reports' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url || '/' },
      tag: 'mealnova-push',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
