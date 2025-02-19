// Service Worker File: sw.js

const CACHE_NAME = 'mountain-circles-cache-v1';

// List files to pre-cache. Adjust this to match the core files of your site.
const FILES_TO_CACHE = [
  '/',             // your site's root
  '/index.html'    // adjust the path if your entry point is different (e.g., '/beta/index.html')
];

// Install event: Pre-cache essential files.
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(FILES_TO_CACHE);
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
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Serve from cache if present.
      if (cachedResponse) {
        console.log(`[Service Worker] Serving from cache: ${event.request.url}`);
        
        // Optionally, asynchronously update the cache in the background.
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

      // Else, fetch from the network.
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            console.log(`[Service Worker] Fetched from network: ${event.request.url}`);
            // Open the cache and store the clone of the response.
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch((error) => {
          console.error(`[Service Worker] Fetch failed for: ${event.request.url}`, error);
          // Optionally: you might return a fallback page or image if offline.
          throw error;
        });
    })
  );
}); 