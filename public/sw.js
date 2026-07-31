/* Ledger — service worker. Two jobs:
     1. Cache-first app shell, so the mobile app still opens with no signal.
     2. Drain the offline outbox via Background Sync when the connection
        comes back, even if the app isn't open.
   /api is always network-only — an API response must never be served from
   the cache; a stale "Saved" would be worse than an honest failure for a
   tool that exists to catch missing stock/cash.
   Registered by index.html only — the admin dashboard assumes a desk
   connection and doesn't need any of this. */

importScripts('db.js', 'outbox.js');

var CACHE_NAME = 'ledger-shell-v1';
var SHELL_FILES = [
  '/',
  '/index.html',
  '/styles.css',
  '/shared.js',
  '/db.js',
  '/outbox.js',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(SHELL_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names.filter(function (n) { return n !== CACHE_NAME; }).map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  if (url.pathname === '/api') return; // never intercept — network-only, no exceptions
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request)
        .then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
          }
          return res;
        })
        .catch(function () {
          if (event.request.mode === 'navigate') return caches.match('/index.html');
        });
    })
  );
});

self.addEventListener('sync', function (event) {
  if (event.tag === 'ledger-outbox-sync') {
    event.waitUntil(drainOutbox());
  }
});
