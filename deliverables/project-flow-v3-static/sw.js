/*
 * Project Flow service worker: keeps the app shell available when the connection drops.
 * - Built files (/assets/*, icons, manifest): cache first, they are fingerprinted or rarely change.
 * - Page navigations: network first, falling back to the cached shell so the app opens offline.
 * - Data (Apps Script, /api, the local simulator) and the Vite dev server are never cached or touched.
 * Bump VERSION to drop the old caches on the next visit.
 */
const VERSION = 'v1';
const SHELL = `projectflow-shell-${VERSION}`;
const ASSETS = `projectflow-assets-${VERSION}`;
const PRECACHE = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/favicon.ico'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('projectflow-') && k !== SHELL && k !== ASSETS).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isDevOrData = url =>
  url.origin !== self.location.origin ||
  url.pathname.startsWith('/api') || url.pathname.startsWith('/exec') ||
  url.pathname.startsWith('/@') || url.pathname.startsWith('/src/') || url.pathname.startsWith('/node_modules/');

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (isDevOrData(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => { const copy = res.clone(); caches.open(SHELL).then(c => c.put('/', copy)); return res; })
        .catch(() => caches.match('/').then(r => r ?? Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(hit => hit ?? fetch(request).then(res => {
      if (res.ok && (url.pathname.startsWith('/assets/') || /\.(png|ico|webmanifest|svg|woff2?)$/.test(url.pathname))) {
        const copy = res.clone();
        caches.open(ASSETS).then(c => c.put(request, copy));
      }
      return res;
    })),
  );
});
