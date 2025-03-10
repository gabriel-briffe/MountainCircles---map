// Service Worker File: sw.js

const CACHE_NAME = 'mountaincircles-v2';
const TILE_CACHE_NAME = 'mountaincircles-tiles-v1';
const GEOJSON_CACHE_NAME = 'mountaincircles-geojson-v1';
const DYNAMIC_CACHE_NAME = 'mountaincircles-dynamic-v1';

const BASE_PATH = '/MountainCircles---map';

// Global counter for the number of network fetches served (i.e., when there's no cached response)
let networkFetchCount = 0;

// Resources to cache immediately on install
const INITIAL_CACHE_URLS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/peaks.geojson`,
  `${BASE_PATH}/passes.geojson`,
  `${BASE_PATH}/icons/icon-192.png`,
  'https://cdn.jsdelivr.net/npm/maplibre-gl@latest/dist/maplibre-gl.js',
  'https://cdn.jsdelivr.net/npm/maplibre-gl@latest/dist/maplibre-gl.css',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round'
];

// Cache GeoJSON files for each policy and configuration
const POLICY_CONFIGS = {
  'alps': ['10-100-250-4200', '20-100-250-4200', '25-100-250-4200', '30-100-250-4200'],
  'West_alps_with_fields': ['10-100-250-4200', '20-100-250-4200', '25-100-250-4200', '30-100-250-4200']
};

// Install event - cache initial resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(INITIAL_CACHE_URLS))
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('mountaincircles-'))
          .filter(name => ![CACHE_NAME, TILE_CACHE_NAME, GEOJSON_CACHE_NAME, DYNAMIC_CACHE_NAME].includes(name))
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Helper function to normalize URLs
function normalizeUrl(url) {
  return url.pathname.startsWith(BASE_PATH) ? url.pathname : `${BASE_PATH}${url.pathname}`;
}

// Fetch event - serve from network first for index.html and sw.js, cache first for everything else
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests and requests to other domains that aren't glyph requests
  if (event.request.method !== 'GET' || 
      (!url.pathname.startsWith(BASE_PATH) && !url.pathname.includes('/font/'))) {
    return;
  }

  // Handle tile requests
  if (url.pathname.includes('/tiles/')) {
    event.respondWith(handleTileRequest(event.request));
    return;
  }

  // Handle GeoJSON requests
  if (url.pathname.endsWith('.geojson')) {
    event.respondWith(handleGeoJSONRequest(event.request));
    return;
  }

  // Handle glyph requests from maplibre
  if (url.hostname === 'demotiles.maplibre.org' && url.pathname.includes('/font/')) {
    event.respondWith(handleGlyphRequest(event.request));
    return;
  }

  // Cache-first strategy for all other requests
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then(response => {
            if (response.ok) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseToCache));
            }
            return response;
          })
          .catch(error => {
            console.error('Fetch failed:', error);
            return new Response('Network error', { status: 503 });
          });
      })
  );
});

// Handle tile requests
async function handleTileRequest(request) {
  const cache = await caches.open(TILE_CACHE_NAME);
  try {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('Tile fetch failed:', error);
    return new Response('Tile not available offline', { status: 404 });
  }
}

// Handle GeoJSON requests
async function handleGeoJSONRequest(request) {
  try {
    // Check dynamic cache first
    const dynamicCache = await caches.open(DYNAMIC_CACHE_NAME);
    let response = await dynamicCache.match(request);
    if (response) {
      return response;
    }

    // Then check regular GeoJSON cache
    const cache = await caches.open(GEOJSON_CACHE_NAME);
    response = await cache.match(request);
    if (response) {
      return response;
    }

    // If not in cache, fetch from network
    response = await fetch(request);
    if (response.ok) {
      // Store in regular GeoJSON cache
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('GeoJSON fetch failed:', error);
    return new Response('GeoJSON not available offline', { status: 404 });
  }
}

// Add a function to handle glyph range requests
async function handleGlyphRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  let response = await cache.match(request);
  
  if (!response) {
    try {
      // The ranges we want to cache
      const ranges = [
        '0-255',
        '256-511',
        // '512-767',
        // '768-1023',
        // '1024-1279',
        // '1280-1535',
        // '1536-1791',
        // '1792-2047',
        // '2048-2303',
        // '2304-2559',
        // '2560-2815',
        // '2816-3071',
        // '3072-3327',
        // '3328-3583',
        // '3584-3839',
        // '3840-4095'
      ];

      // The fontstack we're using
      const fontstacks = ['Open Sans Regular'];

      // If this is a glyph request, cache all ranges for this fontstack
      if (request.url.includes('/font/')) {
        const fontstack = fontstacks[0]; // Use the first fontstack
        
        // Cache all ranges for this fontstack
        for (const range of ranges) {
          const glyphUrl = `https://demotiles.maplibre.org/font/${fontstack}/${range}.pbf`;
          const glyphResponse = await fetch(glyphUrl);
          if (glyphResponse.ok) {
            await cache.put(glyphUrl, glyphResponse.clone());
          }
        }
      }

      // Fetch and return the originally requested glyph file
      response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
    } catch (error) {
      console.error('Failed to fetch glyph:', error);
    }
  }
  
  return response;
}

// Handle messages from the client
self.addEventListener('message', async (event) => {
  if (event.data.type === 'cacheFiles') {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    let completed = 0;
    const total = event.data.files.length;
    
    // Send initial message to confirm receipt
    event.source.postMessage({
      type: 'cacheStart',
      message: `Starting to cache ${total} files`
    });
    
    // Process files one at a time to ensure reliable progress updates
    for (const file of event.data.files) {
      try {
        // Construct the full URL with BASE_PATH
        const url = new URL(`${BASE_PATH}/${file}`, self.location.origin).href;
        event.source.postMessage({
          type: 'cacheProgress',
          message: `Attempting to fetch: ${url}`,
          completed: completed,
          total: total,
          currentFile: file
        });
        
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          completed++;
          event.source.postMessage({
            type: 'cacheProgress',
            message: `Successfully cached: ${file}`,
            completed: completed,
            total: total,
            currentFile: file
          });
        } else {
          event.source.postMessage({
            type: 'cacheError',
            message: `Failed to fetch ${file}: ${response.status} ${response.statusText}`
          });
        }
      } catch (error) {
        event.source.postMessage({
          type: 'cacheError',
          message: `Failed to cache ${file}: ${error.message}`
        });
      }
    }
    
    // Send completion message
    event.source.postMessage({
      type: 'cacheComplete',
      message: `Successfully cached ${completed} of ${total} files`
    });
  }

  if (event.data.type === 'cacheTiles') {
    const cache = await caches.open('mountaincircles-tiles-v1');
    const tiles = event.data.tiles;
    const basePath = event.data.basePath;
    const BATCH_SIZE = 50; // Process 50 tiles concurrently

    // Process tiles in batches
    for (let i = 0; i < tiles.length; i += BATCH_SIZE) {
        const batch = tiles.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (tile) => {
            try {
                const url = `${basePath}/${tile.z}/${tile.x}/${tile.y}.png`;
                const response = await fetch(url);
                if (response.ok) {
                    await cache.put(url, response);
                }
                // Always notify progress, even for 404s
                event.source.postMessage({
                    type: 'cacheTileComplete'
                });
            } catch (error) {
                console.error('Error caching tile:', error);
                // Continue with next tile even if one fails
                event.source.postMessage({
                    type: 'cacheTileComplete'
                });
            }
        }));
    }
  }
}); 