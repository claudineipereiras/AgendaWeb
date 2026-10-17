const CACHE_NAME = 'agendaweb-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/tokens.css',
  './css/style.css',
  './js/db.js',
  './js/api.js',
  './js/app.js',
  './assets/logo.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network first for APIs, cache first for static app shell
  if (event.request.url.includes('/api/') || event.request.url.includes('.php')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
  }
});
