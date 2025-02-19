// Service Worker File: sw.js

const CACHE_NAME = 'mountain-circles-cache-v1';
// Global counter for the number of network fetches served (i.e., when there's no cached response)
let networkFetchCount = 0;

// Files to pre-cache (we're not caching HTML files)
/* We leave this empty (or only include non-HTML assets) since you mentioned
   you don't want to cache any HTML pages because they will evolve. */
const FILES_TO_CACHE = [];

// Install event: Pre-cache essential files.
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching assets:', FILES_TO_CACHE);
      return cache.addAll(FILES_TO_CACHE).catch((error) => {
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
  // Only process GET requests.
  if (event.request.method !== 'GET') return;

  // Check if the request is for HTML based on the "Accept" header.
  // We do not cache HTML pages because they are expected to evolve.
  const acceptHeader = event.request.headers.get('accept');
  if (acceptHeader && acceptHeader.includes('text/html')) {
    // Let the browser fetch HTML from the network (and do not count these).
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        console.log(`[Service Worker] Serving from cache: ${event.request.url}`);
        // Return the cached response immediately, with no refresh.
        return cachedResponse;
      }

      // No cached response -- fetch the resource from the network.
      return fetch(event.request)
        .then((networkResponse) => {
          // Increment our counter for every network fetch.
          networkFetchCount++;
          console.log(`[Service Worker] Network fetch count: ${networkFetchCount}`);
          if (networkResponse && networkResponse.status === 200) {
            // Clone the response for caching.
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              console.log(`[Service Worker] Fetched and caching: ${event.request.url}`);
              cache.put(event.request, responseClone);
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