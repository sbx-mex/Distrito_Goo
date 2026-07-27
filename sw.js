const CACHE_NAME = 'distrito-go-v21.0.0-auditoria-integral';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './README.md',
  './styles/variables.css',
  './styles/app.css',
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
  './modules/celebration-pdf.js',
  './assets/vendor/pdf-lib.esm.min.js',
  './assets/icons/icon-128.png',
  './assets/icons/icon-144.png',
  './assets/icons/icon-152.png',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-384.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-72.png',
  './assets/icons/icon-96.png',
  './assets/photos/10-pasos-turno.png',
  './assets/photos/Rutina_apertura.jpeg',
  './assets/photos/cdd_3Q_2026.png',
  './assets/photos/coffemaster26.jpeg',
  './assets/photos/dresscode26.jpeg',
  './assets/photos/clockin_out.jpg',
  './assets/photos/resumen_comunicado_semana_actual.png',
  './assets/photos/concurso_venta_dona_julio.jpeg',
  './assets/photos/cortado_leche.jpeg',
  './assets/photos/maquila_actualizado.png',
  './assets/photos/pinpad-atb-cambios.png',
  './assets/photos/store-walk.png',
  './assets/photos/verificacion-cafe-espresso.png',
  './assets/img/bearistahugger.jpeg',
  './assets/tools/espresso-hub.jpeg',
  './assets/premium/duty-roster/domingo_drive_thru.png',
  './assets/premium/duty-roster/domingo_lobby.png',
  './assets/premium/duty-roster/jueves_espresso.png',
  './assets/premium/duty-roster/jueves_lobby.png',
  './assets/premium/duty-roster/lunes_food.png',
  './assets/premium/duty-roster/lunes_showcase.png',
  './assets/premium/duty-roster/martes_lobby.png',
  './assets/premium/duty-roster/martes_pic.png',
  './assets/premium/duty-roster/miercoles_boh.png',
  './assets/premium/duty-roster/sabado_cbs.png',
  './assets/premium/duty-roster/viernes_cafe_filtrado.png'
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
    return (await cache.match(request)) || (fallbackUrl ? await cache.match(fallbackUrl) : undefined) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
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
