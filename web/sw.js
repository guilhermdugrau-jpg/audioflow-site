/**
 * AudioFlow Service Worker v2
 * - App shell: stale-while-revalidate (abre na hora e se atualiza sozinho)
 * - HTML: network-first
 * - API: sempre rede
 */

const CACHE_NAME = 'audioflow-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/config.js',
];

const STATIC_FILES = ['style.css', 'app.js', 'config.js'];
const HTML_FILES = ['index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // cache: 'reload' ignora o cache HTTP imutável e pega a versão nova
      await Promise.all(
        STATIC_ASSETS.map(async (url) => {
          try {
            const response = await fetch(new Request(url, { cache: 'reload' }));
            if (response.ok) await cache.put(url, response);
          } catch {
            /* offline: segue com o que já existir */
          }
        })
      );
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  const sameOrigin = url.origin === location.origin;
  const isFont = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');

  if (!sameOrigin && !isFont) return;

  if (sameOrigin && STATIC_FILES.some((file) => url.pathname.endsWith(file))) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  if (sameOrigin && (HTML_FILES.some((file) => url.pathname.endsWith(file)) || url.pathname === '/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (isFont) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Atualiza em segundo plano, sem atrasar a resposta
    network.catch(() => {});
    return cached;
  }

  const response = await network;
  return response || new Response('Offline', { status: 503 });
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}
