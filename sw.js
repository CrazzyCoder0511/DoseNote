/* Offline shell. MedBuddy has no backend, so caching the files is
   enough to make it work with no connection at all. */

/* Bump CACHE whenever the ?v= query on the assets changes. */
const CACHE = 'dosenote-v28';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=28',
  './parser.js?v=28',
  './doctors.js?v=28',
  './scanner.js?v=28',
  './insurance.js?v=28',
  './app.js?v=28',
  './manifest.json',
  './icon.svg',
  './mark.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((hit) => {
      if (hit) return hit;
      return fetch(event.request).catch(() => caches.match('./index.html'));
    })
  );
});

/* Tapping the dose notification brings the app forward. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});
