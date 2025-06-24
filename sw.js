const CACHE_NAME = 'fpl-editor-v2'; // J'incrémente la version pour forcer la mise à jour
const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'app.js',
  'geoUtils.js',
  'generators.js',
  'fileHandlers.js',
  'icon-192x192.png',
  'icon-512x512.png'
];

// Installation du Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Interception des requêtes
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Gérer la requête de partage de fichier
  if (event.request.method === 'POST' && url.pathname === '/index.html') {
    event.respondWith(Response.redirect('/index.html')); // Répond immédiatement pour ouvrir l'app
    event.waitUntil(async function () {
      const formData = await event.request.formData();
      const file = formData.get('fplfile'); // On utilise le nom défini dans le manifest
      if (!file) return;

      const client = await self.clients.get(event.resultingClientId || event.clientId);
      if (client) {
        client.postMessage({ file: file, type: 'FILE_SHARE' });
      }
    }());
    return;
  }
  
  // Stratégie de cache habituelle pour les requêtes GET
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});


// Nettoyage des anciens caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
