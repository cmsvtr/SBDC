// Service worker: app utilizável offline depois da primeira visita.
// Shell em cache-first; dados das normas em stale-while-revalidate.
const VERSAO = 'lexquest-v1';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/engine.js', 'js/game.js', 'js/srs.js', 'js/store.js', 'data/laws/index.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.includes('/data/')) {
    e.respondWith(
      caches.open(VERSAO).then(async (cache) => {
        const cached = await cache.match(e.request);
        const rede = fetch(e.request).then((r) => {
          if (r.ok) cache.put(e.request, r.clone());
          return r;
        }).catch(() => cached);
        return cached || rede;
      }),
    );
    return;
  }

  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
