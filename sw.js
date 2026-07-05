// MCraft service worker: precaches everything so the game runs fully offline.
// Bump the version whenever any asset changes so installed clients update.
const CACHE = 'mcraft-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './js/vendor/three.min.js',
  './js/config.js',
  './js/noise.js',
  './js/blocks.js',
  './js/airbase.js',
  './js/textures.js',
  './js/worldgen.js',
  './js/world.js',
  './js/mesher.js',
  './js/sky.js',
  './js/effects.js',
  './js/player.js',
  './js/minimap.js',
  './js/ui.js',
  './js/touch.js',
  './js/main.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const isNav = e.request.mode === 'navigate';
  e.respondWith(
    // cache-first; navigations ignore ?seed=/?touch= query strings
    caches.match(e.request, { ignoreSearch: isNav }).then(hit =>
      hit || fetch(e.request).catch(() => (isNav ? caches.match('./index.html') : undefined))
    )
  );
});
