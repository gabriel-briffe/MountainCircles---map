// Service Worker File: sw.js

const CACHE_NAME = 'mountain-circles-cache-v1';

// Remove any HTML files from files to pre-cache.
// Optionally, pre-cache other non-HTML assets if needed.
const FILES_TO_CACHE = [
  // e.g., '/styles/main.css', '/scripts/app.js'
];

// Install event: Pre-cache essential files.
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching assets:', FILES_TO_CACHE);
      return cache.addAll(FILES_TO_CACHE).catch((error) => {
        // Log any errors during the pre-cache phase.
        console.error('[Service Worker] Pre-caching failed:', error);
      });
    })
  );
  // Activate this SW immediately
  self.skipWaiting();
});

// Activate event: Clean up any old caches.
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  // Take control of all clients immediately.
  self.clients.claim();
});

// Fetch event: Cache every GET request.
self.addEventListener('fetch', (event) => {
  // Only handle GET requests.
  if (event.request.method !== 'GET') return;

  // Check if this request is for an HTML document.
  // If so, do a network fetch without caching.
  const acceptHeader = event.request.headers.get('accept');
  if (acceptHeader && acceptHeader.includes('text/html')) {
    // Do not cache HTML files, as they may change over time.
    return;
  }

  // For all other GET requests (e.g. tiles, GeoJSON, scripts, fonts, icons),
  // attempt a cache-first strategy.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        console.log(`[Service Worker] Serving from cache: ${event.request.url}`);
        // Optionally, update the cache in the background.
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              console.log(`[Service Worker] Refreshing cache for: ${event.request.url}`);
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          })
          .catch((error) => {
            console.error(`[Service Worker] Background fetch failed for: ${event.request.url}`, error);
          });
        return cachedResponse;
      }

      // Otherwise fetch from the network and dynamically cache the response.
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              console.log(`[Service Worker] Fetched and caching: ${event.request.url}`);
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch((error) => {
          console.error(`[Service Worker] Fetch failed for: ${event.request.url}`, error);
          throw error;
        });
    })
  );
}); 