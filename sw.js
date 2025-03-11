// Service Worker File: sw.js

const CACHE_NAME = 'mountaincircles-v2';
const TILE_CACHE_NAME = 'mountaincircles-tiles-v1';
const GEOJSON_CACHE_NAME = 'mountaincircles-geojson-v1';
const DYNAMIC_CACHE_NAME = 'mountaincircles-dynamic-v1';

const BASE_PATH = '/MountainCircles---map';

// Global counter for the number of network fetches served (i.e., when there's no cached response)
let networkFetchCount = 0;

// Global counter to track ongoing GeoJSON network fetches
let activeFetches = 0;

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
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round',
  'https://demotiles.maplibre.org/font/Open Sans Regular/0-255.pbf',
  'https://demotiles.maplibre.org/font/Open Sans Regular/256-511.pbf'
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
      .catch(error => console.error('Install cache failed:', error))
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

// Helper function to normalize URLs (unchanged)
function normalizeUrl(url) {
  return url.pathname.startsWith(BASE_PATH) ? url.pathname : `${BASE_PATH}${url.pathname}`;
}

// Helper to send messages to clients
function sendMessageToClients(message) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage(message));
  });
}

// Fetch event - intercept ALL relevant GET requests with timeout alerts
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const shouldIntercept = (
    url.pathname.startsWith(BASE_PATH) ||
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'demotiles.maplibre.org' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  );

  if (!shouldIntercept) {
    return;
  }

  event.respondWith(
    (async () => {
      const cacheKey = event.request;
      // Only trigger spinner for requests loading GeoJSON files.
      const isGeoJSON = url.pathname.endsWith('.geojson');
      if (isGeoJSON) {
        activeFetches++;
        sendMessageToClients({
          type: 'fetchStart',
          url: url.href
        });
      }

      const timeoutId = setTimeout(() => {
        sendMessageToClients({
          type: 'loadWarning',
          url: url.href,
          message: `Warning: "${url.href}" is taking too long to load. It may not be cached or network is slow.`
        });
      }, 5000); // 5-second timeout

      try {
        // Do not trigger spinner for tile requests
        if (url.pathname.includes('/tiles/')) {
          const response = await handleTileRequest(event.request);
          clearTimeout(timeoutId);
          return response;
        } else if (isGeoJSON) {
          const response = await handleGeoJSONRequest(event.request);
          clearTimeout(timeoutId);
          activeFetches--;
          sendMessageToClients({ type: 'fetchComplete', url: url.href });
          return response;
        } else if (url.hostname === 'demotiles.maplibre.org' && url.pathname.includes('/font/')) {
          const response = await handleGlyphRequest(event.request);
          clearTimeout(timeoutId);
          return response;
        } else {
          const cache = await caches.open(CACHE_NAME);
          let response = await cache.match(cacheKey);
          if (response) {
            clearTimeout(timeoutId);
            return response;
          }
          response = await fetch(event.request);
          clearTimeout(timeoutId);
          if (isGeoJSON) {
            activeFetches--;
            sendMessageToClients({ type: 'fetchComplete', url: url.href });
          }
          if (response.ok) {
            await cache.put(cacheKey, response.clone());
          }
          return response;
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if (isGeoJSON) {
          activeFetches--;
          sendMessageToClients({ type: 'fetchComplete', url: url.href });
        }
        sendMessageToClients({
          type: 'loadError',
          url: url.href,
          message: `Error: Failed to load "${url.href}" - ${error.message}`
        });
        if (isGeoJSON) {
          return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response('Resource not available offline', { status: 404 });
      }
    })()
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
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('GeoJSON fetch failed:', error);
    return new Response('GeoJSON not available offline', { status: 404 });
  }
}

// Handle glyph requests from Maplibre
async function handleGlyphRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  let response = await cache.match(request);
  
  if (!response) {
    try {
      // The ranges we want to cache
      const ranges = [
        '0-255',
        '256-511',
        // Uncomment additional ranges if needed
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

      // Cache all ranges for this fontstack on first glyph request
      if (request.url.includes('/font/')) {
        const fontstack = fontstacks[0];
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
  
  return response || new Response('Glyph not available offline', { status: 404 });
}

// Handle messages from the client
self.addEventListener('message', async (event) => {
  if (event.data.type === 'cacheFiles') {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    let completed = 0;
    const total = event.data.files.length;
    
    sendMessageToClients({
      type: 'cacheStart',
      message: `Starting to cache ${total} files`
    });
    
    for (const file of event.data.files) {
      try {
        const url = new URL(`${BASE_PATH}/${file}`, self.location.origin).href;
        sendMessageToClients({
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
          sendMessageToClients({
            type: 'cacheProgress',
            message: `Successfully cached: ${file}`,
            completed: completed,
            total: total,
            currentFile: file
          });
        } else {
          sendMessageToClients({
            type: 'cacheError',
            message: `Failed to fetch ${file}: ${response.status} ${response.statusText}`
          });
        }
      } catch (error) {
        sendMessageToClients({
          type: 'cacheError',
          message: `Failed to cache ${file}: ${error.message}`
        });
      }
    }
    
    sendMessageToClients({
      type: 'cacheComplete',
      message: `Successfully cached ${completed} of ${total} files`
    });
  }

  if (event.data.type === 'cacheTiles') {
    const cache = await caches.open(TILE_CACHE_NAME);
    const tiles = event.data.tiles;
    const basePath = event.data.basePath;
    const BATCH_SIZE = 50;

    for (let i = 0; i < tiles.length; i += BATCH_SIZE) {
      const batch = tiles.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (tile) => {
        try {
          const url = `${basePath}/${tile.z}/${tile.x}/${tile.y}.png`;
          const cachedResponse = await cache.match(url);
          if (cachedResponse) {
            event.source.postMessage({ type: 'cacheTileComplete' });
            return;
          }
          
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response.clone());
          }
          event.source.postMessage({ type: 'cacheTileComplete' });
        } catch (error) {
          console.error('Error caching tile:', error);
          event.source.postMessage({ type: 'cacheTileComplete' });
        }
      }));
    }
  }
});