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

// Bump this whenever the shell files change meaningfully — it's what forces
// browsers holding an old, already-installed service worker to fetch fresh
// copies instead of serving whatever they cached last time.
var CACHE_NAME = 'ledger-shell-v3';
var SHELL_FILES = [
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
  var req = event.request;
  var url = new URL(req.url);

  if (url.pathname === '/api') return; // never intercept — network-only, no exceptions
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Every shell file is already saved during install (below), so this is
  // deliberately simple: serve the precached copy if there is one, else go
  // to the network. No runtime re-caching here — writing a live response
  // back into the cache on every request (including full-page navigations)
  // is a known source of hard-to-diagnose failures in some browsers, and
  // isn't needed since the shell is already covered by install-time caching.
  //
  // Everything below is wrapped so this can NEVER hand event.respondWith()
  // a rejected promise — that's what produces a browser-level "site can't
  // be reached" page instead of an actual response. Whatever goes wrong,
  // this always resolves to *some* Response.
  event.respondWith(
    caches.match(req)
      .then(function (cached) { return cached || fetch(req); })
      .catch(function () {
        return caches.match('/index.html').then(function (fallback) {
          return fallback || new Response(
            'Ledger is offline and this page was not cached yet — reconnect and try again.',
            { status: 503, headers: { 'Content-Type': 'text/plain' } }
          );
        });
      })
  );
});

self.addEventListener('sync', function (event) {
  if (event.tag === 'ledger-outbox-sync') {
    event.waitUntil(drainOutbox());
  }
});
