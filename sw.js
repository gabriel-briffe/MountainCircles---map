// Service Worker File: sw.js

/**
 * MountainCircles Map Service Worker
 * Caching Strategy:
 * - Files are cached indefinitely with no expiration
 * - Users must manually trigger updates via the "Update App" button
 * - Different cache stores are used for different types of resources
 * - Old caches are cleaned up only when service worker version changes
 */

const CACHE_NAME = 'mountaincircles-v2';
const TILE_CACHE_NAME = 'mountaincircles-tiles-v1';
const GEOJSON_CACHE_NAME = 'mountaincircles-geojson-v1';
const DYNAMIC_CACHE_NAME = 'mountaincircles-dynamic-v1';
const AIRSPACE_CACHE_NAME = 'mountaincircles-airspace-v1';

// Automatically determine base path from service worker scope
function getBasePath() {
    try {        
        // Check if on GitHub Pages site
        if (self.location.hostname === 'gabriel-briffe.github.io') {
            return '/MountainCircles---map';
        }
        
        // For localhost development server
        if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
            return '';
        }
        
        // Default for other scenarios
        return '.';
    } catch (e) {
        console.error('SW - Error in getBasePath:', e);
        return '.';
    }
}

const BASE_PATH = getBasePath();

// Global counter for the number of network fetches served (i.e., when there's no cached response)
let networkFetchCount = 0;

// Global counter to track ongoing GeoJSON network fetches
let activeFetches = 0;

// External resources that should be cached on install but not updated with the app
const EXTERNAL_RESOURCES = [
    // External libraries, fonts and resources
    'https://cdn.jsdelivr.net/npm/maplibre-gl@latest/dist/maplibre-gl.js',
    'https://cdn.jsdelivr.net/npm/maplibre-gl@latest/dist/maplibre-gl.css',
    'https://fonts.googleapis.com/icon?family=Material+Icons+Round',
    'https://demotiles.maplibre.org/font/Open%20Sans%20Regular,Arial%20Unicode%20MS%20Regular/0-255.pbf',
    'https://demotiles.maplibre.org/font/Open%20Sans%20Regular,Arial%20Unicode%20MS%20Regular/256-511.pbf'
];

// Initial resources to cache on install - includes all files needed for offline functionality
const INITIAL_CACHE_RESOURCES = [
    // HTML files
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/manifest.json`,
    
    // CSS files
    `${BASE_PATH}/styles.css`,
    
    // Core JS files
    `${BASE_PATH}/config.js`,
    `${BASE_PATH}/coreFiles.js`,
    `${BASE_PATH}/sw.js`,
    
    // Map and functionality JS files
    `${BASE_PATH}/airspace.js`,
    `${BASE_PATH}/airspaceStyle.js`,
    `${BASE_PATH}/appUpdate.js`,
    `${BASE_PATH}/cacheConfig.js`,
    `${BASE_PATH}/dock.js`,
    `${BASE_PATH}/igc.js`,
    `${BASE_PATH}/init.js`,
    `${BASE_PATH}/install.js`,
    `${BASE_PATH}/LayerManager.js`,
    `${BASE_PATH}/layers.js`,
    `${BASE_PATH}/layerStyles.js`,
    `${BASE_PATH}/location.js`,
    `${BASE_PATH}/map.js`,
    `${BASE_PATH}/mapInitializer.js`,
    `${BASE_PATH}/mappings.js`,
    `${BASE_PATH}/menu.js`,
    `${BASE_PATH}/navboxManager.js`,
    `${BASE_PATH}/sidebar.js`,
    `${BASE_PATH}/state.js`,
    `${BASE_PATH}/toggleManager.js`,
    `${BASE_PATH}/tracking.js`,
    `${BASE_PATH}/utils.js`,
    
    // GeoJSON data files
    `${BASE_PATH}/peaks.geojson`,
    `${BASE_PATH}/passes.geojson`,
    `${BASE_PATH}/airspace.geojson`,
    
    // Icons
    `${BASE_PATH}/icons/icon-192.png`,
    
    // External resources
    ...EXTERNAL_RESOURCES
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
            .then(cache => cache.addAll(INITIAL_CACHE_RESOURCES))
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
          .filter(name => ![CACHE_NAME, TILE_CACHE_NAME, GEOJSON_CACHE_NAME, DYNAMIC_CACHE_NAME, AIRSPACE_CACHE_NAME].includes(name))
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Helper function to normalize URLs
function normalizeUrl(url) {
  // If BASE_PATH is empty (localhost), just return the pathname
  if (BASE_PATH === '') {
    return url.pathname;
  }
  
  // If BASE_PATH is a dot (relative path), check if pathname starts with /
  if (BASE_PATH === '.') {
    return url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
  }
  
  // For GitHub Pages (absolute path with BASE_PATH)
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
        if (url.pathname.includes('/tiles/') || url.pathname.includes('/edl_tiles/')) {
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
    const url = new URL(request.url);
    console.debug(`[SW] Handling GeoJSON request: ${url.pathname}`);
    
    // Special handling for airspace.geojson
    if (url.pathname.endsWith('airspace.geojson')) {
      console.debug(`[SW] Special handling for airspace.geojson`);
      const airspaceCache = await caches.open(AIRSPACE_CACHE_NAME);
      console.debug(`[SW] Opened airspace cache: ${AIRSPACE_CACHE_NAME}`);
      
      let response = await airspaceCache.match(request);
      if (response) {
        console.debug(`[SW] Found airspace.geojson in cache`);
        return response;
      }
      
      console.debug(`[SW] airspace.geojson not in cache, fetching from network`);
      response = await fetch(request);
      if (response.ok) {
        console.debug(`[SW] Successfully fetched airspace.geojson, caching`);
        await airspaceCache.put(request, response.clone());
      }
      return response;
    }
    
    // For configuration GeoJSON files (dynamic layers, config files, etc.)
    // Use a simpler strategy: store everything in DYNAMIC_CACHE_NAME
    
    // Determine which cache to use based on the path pattern
    let cacheToUse;
    
    // Files in a subdirectory like 'alps/10-100-250-4200/...' are configuration files
    // or dynamic layer files, store them in DYNAMIC_CACHE_NAME
    if (url.pathname.includes('/') && !url.pathname.endsWith('peaks.geojson') && !url.pathname.endsWith('passes.geojson')) {
      cacheToUse = DYNAMIC_CACHE_NAME;
      console.debug(`[SW] Using dynamic cache for: ${url.pathname}`);
    } else {
      // Basic GeoJSON files (peaks, passes, etc.) go in the regular GeoJSON cache
      cacheToUse = GEOJSON_CACHE_NAME;
      console.debug(`[SW] Using regular GeoJSON cache for: ${url.pathname}`);
    }
    
    // Open the appropriate cache
    const cache = await caches.open(cacheToUse);
    
    // Check if the file is in cache
    let response = await cache.match(request);
    if (response) {
      console.debug(`[SW] Found in cache: ${url.pathname}`);
      return response;
    }
    
    // If not in cache, also check the other cache as a fallback
    // (in case previously cached in the wrong location)
    const otherCacheName = (cacheToUse === DYNAMIC_CACHE_NAME) ? GEOJSON_CACHE_NAME : DYNAMIC_CACHE_NAME;
    const otherCache = await caches.open(otherCacheName);
    
    response = await otherCache.match(request);
    if (response) {
      console.debug(`[SW] Found in fallback cache (${otherCacheName}): ${url.pathname}`);
      // Store in the preferred cache for next time
      await cache.put(request, response.clone());
      return response;
    }
    
    // If not in either cache, fetch from network
    console.debug(`[SW] Fetching from network: ${url.pathname}`);
    response = await fetch(request);
    
    if (response.ok) {
      console.debug(`[SW] Successfully fetched, caching in: ${cacheToUse}`);
      await cache.put(request, response.clone());
    } else {
      console.error(`[SW] Failed to fetch: ${response.status} ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    console.error('[SW] GeoJSON fetch failed:', error);
    // Return an empty GeoJSON response to prevent UI errors
    return new Response(JSON.stringify({ 
      type: 'FeatureCollection', 
      features: [] 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
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

      // The fontstack we're using - Updated with URL encoding and proper format
      const fontstack = 'Open%20Sans%20Regular,Arial%20Unicode%20MS%20Regular';

      // Cache all ranges for this fontstack on first glyph request
      if (request.url.includes('/font/')) {
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
    console.debug('[SW] Received cacheFiles message with', event.data.files.length, 'files');
    console.debug('[SW] Config:', event.data.config);
    
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    console.debug('[SW] Opened dynamic cache:', DYNAMIC_CACHE_NAME);
    
    let completed = 0;
    const total = event.data.files.length;
    
    sendMessageToClients({
      type: 'cacheStart',
      message: `Starting to cache ${total} files`
    });
    
    console.debug('[SW] Files to cache:', event.data.files);
    
    for (const file of event.data.files) {
      try {
        // Handle paths based on BASE_PATH
        let url;
        if (BASE_PATH === '') {
          // For localhost (empty BASE_PATH)
          url = new URL(file, self.location.origin).href;
          console.debug(`[SW] Localhost path: ${file}`);
        } else if (file.startsWith(BASE_PATH)) {
          // Path already has BASE_PATH, use it directly
          url = new URL(file, self.location.origin).href;
          console.debug(`[SW] Path already contains BASE_PATH: ${file}`);
        } else {
          // Path doesn't have BASE_PATH, add it
          url = new URL(`${BASE_PATH}/${file}`, self.location.origin).href;
          console.debug(`[SW] Adding BASE_PATH to path: ${BASE_PATH}/${file}`);
        }
        
        console.debug(`[SW] Fetching URL: ${url}, original file path: ${file}`);
        
        sendMessageToClients({
          type: 'cacheProgress',
          message: `Fetching: ${file}`,
          completed: completed,
          total: total,
          currentFile: file
        });
        
        try {
          const response = await fetch(url);
          console.debug(`[SW] Fetch response for ${file}: status=${response.status}, ok=${response.ok}`);
          
          if (response.ok) {
            await cache.put(url, response);
            completed++;
            console.debug(`[SW] Successfully cached file: ${file}`);
            
            sendMessageToClients({
              type: 'cacheProgress',
              message: `Successfully cached: ${file}`,
              completed: completed,
              total: total,
              currentFile: file
            });
          } else {
            console.error(`[SW] Failed to fetch ${file}: ${response.status} ${response.statusText}`);
            
            sendMessageToClients({
              type: 'cacheError',
              message: `Failed to fetch ${file}: ${response.status} ${response.statusText}`
            });
          }
        } catch (fetchError) {
          console.error(`[SW] Fetch error for ${file}:`, fetchError);
          
          sendMessageToClients({
            type: 'cacheError',
            message: `Failed to fetch ${file}: ${fetchError.message}`
          });
        }
      } catch (error) {
        console.error(`[SW] General error caching ${file}:`, error);
        
        sendMessageToClients({
          type: 'cacheError',
          message: `Failed to cache ${file}: ${error.message}`
        });
      }
    }
    
    console.debug(`[SW] Completed caching: ${completed} of ${total} files`);
    
    sendMessageToClients({
      type: 'cacheComplete',
      message: `Successfully cached ${completed} of ${total} files`
    });
  }

  if (event.data.type === 'cacheTiles') {
    console.debug('[SW] Received cacheTiles message');
    
    const cache = await caches.open(TILE_CACHE_NAME);
    console.debug('[SW] Opened tile cache:', TILE_CACHE_NAME);
    
    const tiles = event.data.tiles;
    const basePath = event.data.basePath;
    console.debug(`[SW] Tile caching - total tiles: ${tiles.length}, basePath: ${basePath}`);
    
    const BATCH_SIZE = 50;

    for (let i = 0; i < tiles.length; i += BATCH_SIZE) {
      const batch = tiles.slice(i, i + BATCH_SIZE);
      console.debug(`[SW] Processing tile batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(tiles.length/BATCH_SIZE)}, batch size: ${batch.length}`);
      
      await Promise.all(batch.map(async (tile) => {
        try {
          // Handle paths based on BASE_PATH
          let url;
          if (BASE_PATH === '') {
            // For localhost (empty BASE_PATH)
            url = `${basePath}/${tile.z}/${tile.x}/${tile.y}.png`;
          } else if (basePath.startsWith(BASE_PATH)) {
            // Path already has BASE_PATH, use it directly
            url = `${basePath}/${tile.z}/${tile.x}/${tile.y}.png`;
          } else {
            // Path doesn't have BASE_PATH, add it
            url = `${BASE_PATH}/${basePath}/${tile.z}/${tile.x}/${tile.y}.png`;
          }
          
          console.debug(`[SW] Checking tile at: ${url}`);
          
          const cachedResponse = await cache.match(url);
          if (cachedResponse) {
            console.debug(`[SW] Tile already cached: ${url}`);
            event.source.postMessage({ type: 'cacheTileComplete' });
            return;
          }
          
          console.debug(`[SW] Fetching tile: ${url}`);
          const response = await fetch(url);
          
          if (response.ok) {
            console.debug(`[SW] Successfully fetched tile: ${url}`);
            await cache.put(url, response.clone());
            console.debug(`[SW] Cached tile: ${url}`);
          } else {
            console.error(`[SW] Failed to fetch tile: ${url}, status: ${response.status}`);
          }
          
          event.source.postMessage({ type: 'cacheTileComplete' });
        } catch (error) {
          console.error('[SW] Error caching tile:', error, 'for tile:', tile);
          event.source.postMessage({ 
            type: 'cacheTileError', 
            error: error.message,
            tileInfo: `z:${tile.z}/x:${tile.x}/y:${tile.y}`
          });
        }
      }));
    }
  }
  
  // New handler for updating app files
  if (event.data.type === 'updateAppFiles') {
    // Get the files list from the message data
    const filesToUpdate = event.data.files;
    
    // Verify we have files to update
    if (!filesToUpdate || !Array.isArray(filesToUpdate) || filesToUpdate.length === 0) {
      sendMessageToClients({
        type: 'appUpdateFailed',
        message: 'Update failed: No files list provided. Your app is unchanged.'
      });
      return;
    }
        
    // Start update notification
    sendMessageToClients({
        type: 'appUpdateStart',
        message: `Starting to update ${filesToUpdate.length} app files`
    });
    
    // PHASE 1: Download all files to temporary storage
    const tempStorage = new Map(); // In-memory storage for downloads
    let completed = 0;
    let failed = false;
    
    for (const file of filesToUpdate) {
        try {
            const url = new URL(file, self.location.origin).href;
            
            sendMessageToClients({
                type: 'appUpdateProgress',
                message: `Downloading: ${file}`,
                completed: completed,
                total: filesToUpdate.length,
                currentFile: file
            });
            
            // Try to download the file
            const response = await fetch(url, { cache: 'no-store' });
            
            if (response.ok) {
                // Store the response in memory temporarily
                tempStorage.set(url, await response.clone().blob());
                completed++;
                
                sendMessageToClients({
                    type: 'appUpdateProgress',
                    message: `Downloaded: ${file}`,
                    completed: completed,
                    total: filesToUpdate.length,
                    currentFile: file
                });
            } else {
                failed = true;
                console.error(`SW - Download failed: ${url} - ${response.status} ${response.statusText}`);
                sendMessageToClients({
                    type: 'appUpdateError',
                    message: `Failed to download ${file}: ${response.status} ${response.statusText}`,
                    needsCleanup: true
                });
                break; // Stop on first failure
            }
        } catch (error) {
            failed = true;
            console.error(`SW - Download error: ${file} - ${error.message}`);
            sendMessageToClients({
                type: 'appUpdateError',
                message: `Failed to download ${file}: ${error.message}`,
                needsCleanup: true
            });
            break; // Stop on first failure
        }
    }
    
    // If any download failed, abort the update
    if (failed) {
        sendMessageToClients({
            type: 'appUpdateFailed',
            message: 'Update aborted: Some files could not be downloaded. Your app is unchanged.'
        });
        return;
    }
    
    // PHASE 2: All downloads succeeded, now update the cache
    try {
        const cache = await caches.open(CACHE_NAME);
        
        // Update each file in the cache
        for (const [url, blob] of tempStorage.entries()) {
            const headers = new Headers({
                'Content-Type': getContentType(url),
                'Content-Length': blob.size.toString(),
                'Last-Modified': new Date().toUTCString()
            });
            
            const response = new Response(blob, {
                status: 200,
                statusText: 'OK',
                headers: headers
            });
            
            await cache.put(url, response);
        }
        
        // Notify completion
        sendMessageToClients({
            type: 'appUpdateComplete',
            message: `Successfully updated ${filesToUpdate.length} app files`,
            needsReload: true
        });
    } catch (error) {
        sendMessageToClients({
            type: 'appUpdateFailed',
            message: `Cache update failed: ${error.message}. Your app is unchanged.`
        });
    }
  }
});

// Helper function to determine content type from URL
function getContentType(url) {
  const extension = url.split('.').pop().toLowerCase();
  switch (extension) {
    case 'html': return 'text/html';
    case 'css': return 'text/css';
    case 'js': return 'application/javascript';
    case 'json': return 'application/json';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}