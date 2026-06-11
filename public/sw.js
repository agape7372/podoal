// IMPORTANT: bump CACHE_VERSION whenever you change which assets you want to
// invalidate on the next deploy. The activate handler deletes every cache
// whose name doesn't match the current value, so users get a fresh shell.
const CACHE_VERSION = '2026-06-11-rsc-guard';
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

  // App Router 클라이언트 네비게이션의 RSC 페치(?_rsc=… / RSC: 1 헤더)는 문서와 같은
  // URL 공간을 쓰는 '데이터'다 — cache-first로 재서빙하면 stale payload가 라우터
  // 전환을 영구 미커밋 상태로 만들고(탭 눌러도 화면 무반응), 배포 후엔 죽은 해시
  // 청크를 참조해 하드 리로드 폴백을 유발한다. SW가 개입하지 않고 통과시킨다.
  // (navigate 문서를 network-first로 고친 위 수정과 같은 버그 클래스 — RSC 누락분.)
  if (url.searchParams.has('_rsc') || request.headers.get('RSC') === '1') {
    return;
  }

  // 진짜 정적 자산만 Cache First (화이트리스트 — 예전 catch-all이 RSC까지 삼키던
  // 버그의 재발 방지: 목록 밖의 GET은 SW 미개입으로 브라우저 기본 동작을 탄다).
  const isCacheableAsset =
    /^\/(icons|avatars)\//.test(url.pathname) ||
    /\.(svg|png|jpg|jpeg|webp|ico|woff2?)$/.test(url.pathname) ||
    url.pathname === '/manifest.json';
  if (url.origin === self.location.origin && isCacheableAsset) {
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
  }
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
      // tag lets the server collapse repeats (e.g. the same reminder) into one
      // OS toast instead of stacking. Absent tag → undefined → normal behavior.
      tag: data.tag,
      data: data,
    })
  );
});

// Notification click handler — deep-link to the payload's url (gift board, inbox, …)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/home';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          if (c.navigate) { c.navigate(url).catch(() => {}); }
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
