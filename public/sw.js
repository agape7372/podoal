// IMPORTANT: bump CACHE_VERSION whenever you change which assets you want to
// invalidate on the next deploy. The activate handler deletes every cache
// whose name doesn't match the current value, so users get a fresh shell.
const CACHE_VERSION = '2026-06-03-1';
const CACHE_NAME = `podoal-${CACHE_VERSION}`;
const APP_SHELL = ['/', '/home', '/manifest.json'];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: Network First for API, Cache First for static assets.
// Next.js hash-named chunks under /_next/static/ are intentionally NOT cached
// here — the network already serves them with immutable headers, and caching
// them under our own key risks serving stale chunks after a deploy.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Hash-named Next.js chunks: always hit the network (browser HTTP cache
  // handles long-term caching for these).
  if (url.pathname.startsWith('/_next/static/')) {
    return;
  }

  // API calls: Network First (don't cache so auth-gated responses don't leak
  // across users; offline GETs simply fail).
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    );
    return;
  }

  // HTML navigations (page documents): Network First. The document is what
  // references the current hash-named chunks, so a previously-visited page
  // (e.g. an old board URL) must NOT be served from a stale cache — otherwise
  // it keeps loading old chunks and never picks up a deploy's UI changes.
  // Falls back to cache (then /home) when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/home'))
        )
    );
    return;
  }

  // Other static assets (icons, manifest, images): Cache First with background fill.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  let data = { title: '포도알', body: '새로운 알림이 있어요!', icon: '/icons/icon.svg' };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: '/icons/icon.svg',
      vibrate: [100, 50, 100],
      data: data,
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        return clients[0].focus();
      }
      return self.clients.openWindow('/home');
    })
  );
});
