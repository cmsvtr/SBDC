// Service worker: app utilizável offline depois da primeira visita.
// Rede primeiro (para receber atualizações), cache como reserva quando offline.
// Ao publicar mudanças no shell, incremente VERSAO.
const VERSAO = 'lexquest-v2';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'js/app.js', 'js/engine.js', 'js/game.js', 'js/srs.js', 'js/store.js',
  'data/laws/index.json', 'data/laws/lei-12529.json',
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
  e.respondWith(
    caches.open(VERSAO).then(async (cache) => {
      try {
        const r = await fetch(e.request);
        if (r.ok) cache.put(e.request, r.clone());
        return r;
      } catch {
        const cached = await cache.match(e.request, { ignoreSearch: true });
        if (cached) return cached;
        if (e.request.mode === 'navigate') return cache.match('index.html');
        throw new Error('offline');
      }
    }),
  );
});
