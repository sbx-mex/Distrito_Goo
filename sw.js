const CACHE_NAME = 'distrito-go-v32.0.0-semana-duty-celebraciones';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './README.md',
  './styles/variables.css',
  './styles/app.css',
  './styles/experience.css',
  './styles/clean.css',
  './styles/navigation-v26.css',
  './data/categorias.v10.json',
  './data/herramientas.v10.json',
  './data/favoritos.v10.json',
  './data/dashboard.v10.json',
  './data/config.v10.json',
  './data/identity.json',
  './data/version.v10.json',
  './data/operacional.v10.json',
  './data/cms-build.v1.json',
  './modules/utils.js',
  './modules/storage.js',
  './modules/state.js',
  './modules/data.js',
  './modules/toast.js',
  './modules/native-apps.js',
  './modules/components.js',
  './modules/cards.js',
  './modules/search.js',
  './modules/navigation.js',
  './modules/quick-actions.js',
  './modules/pwa.js',
  './modules/app.js',
  './modules/operational.js',
  './modules/experience.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => undefined)
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request, {ignoreSearch:true})) || (fallbackUrl ? await cache.match(fallbackUrl, {ignoreSearch:true}) : undefined) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, {ignoreSearch:true});
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  if (url.pathname.endsWith('/assets/photos/resumen_comunicado_semana_actual.png')) {
    event.respondWith(networkFirst(request));
    return;
  }

  const isRuntimeFile = /\.(?:html|css|js|json)$/i.test(url.pathname);
  event.respondWith(isRuntimeFile ? networkFirst(request) : cacheFirst(request));
});

self.addEventListener('message', event => {
  if(event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
