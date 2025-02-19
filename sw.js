// Service Worker File: sw.js

const CACHE_NAME = 'mountain-circles-cache-v1';

// List files to pre-cache. Adjust this to match the core files of your site.
const FILES_TO_CACHE = [
  '/',             // your site's root
  '/index.html'    // adjust the path if your entry point is different (e.g., '/beta/index.html')
];

// Install event: Pre-cache essential files.
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline assets');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  // Activate this SW immediately
  self.skipWaiting();
});

// Activate event: Clean up any old caches.
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', name);
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
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Serve from cache if present.
      if (cachedResponse) {
        // Optionally, update the cache in the background (stale-while-revalidate approach)
        fetch(event.request)
          .then((networkResponse) => {
            // Only cache valid responses (a response with a status of 200).
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          })
          .catch(() => {
            // Network fetch failed; nothing to do.
          });
        return cachedResponse;
      }

      // Else, fetch from the network.
      return fetch(event.request)
        .then((networkResponse) => {
          // Check for a valid response before caching.
          if (networkResponse && networkResponse.status === 200) {
            // Open the cache and store the clone of the response.
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch((error) => {
          // Optionally: you might return a fallback page or image if offline.
          console.error('Fetch failed; returning offline page instead.', error);
          // Example: return caches.match('/offline.html');
          throw error;
        });
    })
  );
}); 