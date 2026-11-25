/**
 * AudioFlow Service Worker v1
 * Cache-first strategy for static assets, network-first for API
 * Instant loading on repeat visits, offline support
 */

const CACHE_NAME = 'audioflow-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/config.js',
];

const CACHE_STRATEGIES = {
  // Cache-first for static assets
  static: ['style.css', 'app.js', 'config.js'],
  // Network-first for HTML (always fresh)
  html: ['index.html'],
  // Stale-while-revalidate for fonts
  fonts: ['fonts.googleapis.com', 'fonts.gstatic.com'],
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
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

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API calls - always network
  if (url.pathname.startsWith('/api/')) return;

  // Skip external domains except fonts
  if (url.origin !== location.origin && !CACHE_STRATEGIES.fonts.some(d => url.hostname.includes(d))) {
    return;
  }

  // Determine strategy
  const isStatic = CACHE_STRATEGIES.static.some(f => url.pathname.endsWith(f));
  const isHtml = CACHE_STRATEGIES.html.some(f => url.pathname.endsWith(f) || url.pathname === '/');

  if (isStatic) {
    // Cache-first for CSS/JS
    event.respondWith(cacheFirst(event.request));
  } else if (isHtml) {
    // Network-first for HTML
    event.respondWith(networkFirst(event.request));
  } else if (url.hostname.includes('fonts.gstatic.com')) {
    // Stale-while-revalidate for font files
    event.respondWith(staleWhileRevalidate(event.request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
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

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// Background sync for failed downloads (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'download-retry') {
    event.waitUntil(retryFailedDownloads());
  }
});

async function retryFailedDownloads() {
  // Implementation for retrying failed downloads when online
  console.log('Background sync: retrying failed downloads');
}