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
        
        // Check if pathname contains the repo name
        if (self.location.pathname.includes('/MountainCircles---map/')) {
            return '/MountainCircles---map';
        }
        
        // Default for local development
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
    `${BASE_PATH}/mbtilesHandler.js`,
    `${BASE_PATH}/mbtilesUI.js`,
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
  const url = new URL(request.url);
  console.log(`[DEBUG-SW] Handling tile request: ${url.pathname}`);
  
  // First check the MBTiles cache for this tile
  const mbtilesCache = await caches.open('mbtiles-cache');
  const cachedMbtilesResponse = await mbtilesCache.match(request);
  if (cachedMbtilesResponse) {
    // Count the number of MBTiles hits for analytics
    networkFetchCount++;
    console.log(`[DEBUG-SW] Found tile in MBTiles cache: ${url.pathname}`);
    return cachedMbtilesResponse;
  }
  
  // If not in MBTiles cache, check regular tile cache
  console.log(`[DEBUG-SW] Tile not in MBTiles cache, checking regular cache: ${url.pathname}`);
  const cache = await caches.open(TILE_CACHE_NAME);
  try {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log(`[DEBUG-SW] Found tile in regular cache: ${url.pathname}`);
      return cachedResponse;
    }
    
    // Try to extract path components that match tile pattern: /tiles/{z}/{x}/{y}.png
    const pathMatch = url.pathname.match(/\/tiles\/(\d+)\/(\d+)\/(\d+)\.png$/);
    if (pathMatch) {
      const z = parseInt(pathMatch[1], 10);
      const x = parseInt(pathMatch[2], 10);
      const y = parseInt(pathMatch[3], 10);
      console.log(`[DEBUG-SW] Tile coordinates: z=${z}, x=${x}, y=${y}`);
      
      // Try to fetch the tile from the network
      try {
        console.log(`[DEBUG-SW] Fetching tile from network: ${url.pathname}`);
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok) {
          // Cache the successful response
          console.log(`[DEBUG-SW] Network fetch successful, caching tile: ${url.pathname}`);
          await cache.put(request, response.clone());
          return response;
        }
        console.log(`[DEBUG-SW] Network fetch failed with status: ${response.status}`);
      } catch (networkError) {
        console.warn(`[DEBUG-SW] Network fetch failed for tile z=${z}, x=${x}, y=${y}:`, networkError);
        // Fall through to transparent tile
      }
      
      // If we get here, the network fetch failed or returned non-ok status
      // Return a transparent tile instead of a 404
      console.log(`[DEBUG-SW] Returning transparent tile for: ${url.pathname}`);
      return createTransparentTile();
    }
    
    // Not a tile or not matched pattern, try network
    console.log(`[DEBUG-SW] Not a recognized tile pattern, fetching from network: ${url.pathname}`);
    const response = await fetch(request);
    if (response.ok) {
      console.log(`[DEBUG-SW] Network fetch successful, caching: ${url.pathname}`);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error(`[DEBUG-SW] Tile fetch failed: ${url.pathname}`, error);
    // Return a transparent PNG if the tile couldn't be fetched
    return createTransparentTile();
  }
}

// Helper function to create a transparent tile
function createTransparentTile() {
  console.log(`[DEBUG-SW] Creating transparent tile`);
  // Create a 1x1 transparent PNG
  const transparentPixel = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  
  return new Response(transparentPixel, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=604800'
    }
  });
}

// Handle GeoJSON requests
async function handleGeoJSONRequest(request) {
  try {
    const url = new URL(request.url);
    
    // Special handling for airspace.geojson
    if (url.pathname.endsWith('airspace.geojson')) {
      const airspaceCache = await caches.open(AIRSPACE_CACHE_NAME);
      let response = await airspaceCache.match(request);
      if (response) {
        return response;
      }
      
      // If not in cache, fetch from network
      response = await fetch(request);
      if (response.ok) {
        await airspaceCache.put(request, response.clone());
      }
      return response;
    }
    
    // For other GeoJSON files, use the existing caching logic
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

  if (event.data.type === 'extractMBTiles') {
    try {
      console.log('[DEBUG-SW] Received extractMBTiles message');
      // Send acknowledgment that extraction has started
      event.source.postMessage({ 
        type: 'mbtilesExtractionStarted',
        message: 'Starting MBTiles extraction'
      });

      // For service worker, we can't directly handle the MBTiles file
      // Instead, we'll wait for individual tile cache messages from the main thread
      
      // Just acknowledge that we're ready for tile caching
      console.log('[DEBUG-SW] Sending mbtilesExtractionReady message');
      event.source.postMessage({ 
        type: 'mbtilesExtractionReady', 
        message: 'Service worker ready for MBTiles extraction'
      });
    } catch (error) {
      console.error('[DEBUG-SW] Error in MBTiles extraction setup:', error);
      event.source.postMessage({ 
        type: 'mbtilesExtractionError', 
        message: `Error in MBTiles extraction: ${error.message}` 
      });
    }
  }

  if (event.data.type === 'cacheMBTilesTile') {
    try {
      const { url, tileData, contentType } = event.data;
      console.log(`[DEBUG-SW] Received cacheMBTilesTile message for: ${url}`);
      
      const cache = await caches.open('mbtiles-cache');
      
      // Create response with the tile data
      const response = new Response(tileData, {
        status: 200,
        headers: { 'Content-Type': contentType }
      });
      
      // Cache the response
      await cache.put(url, response);
      console.log(`[DEBUG-SW] Successfully cached MBTiles tile: ${url}`);
      
      // Acknowledge tile caching
      event.source.postMessage({ 
        type: 'mbtilesExtractTileComplete',
        url: url
      });
    } catch (error) {
      console.error('[DEBUG-SW] Error caching MBTiles tile:', error);
      event.source.postMessage({ 
        type: 'mbtilesExtractTileError',
        message: `Error caching MBTiles tile: ${error.message}`
      });
    }
  }

  if (event.data.type === 'clearMBTilesCache') {
    try {
      console.log('[DEBUG-SW] Received clearMBTilesCache message');
      const cache = await caches.open('mbtiles-cache');
      const keys = await cache.keys();
      console.log(`[DEBUG-SW] Clearing ${keys.length} tiles from MBTiles cache`);
      
      await cache.keys().then(keys => Promise.all(keys.map(key => cache.delete(key))));
      console.log('[DEBUG-SW] MBTiles cache cleared successfully');
      
      event.source.postMessage({ 
        type: 'mbtilesExtractClearComplete',
        message: 'MBTiles cache cleared'
      });
    } catch (error) {
      console.error('[DEBUG-SW] Error clearing MBTiles cache:', error);
      event.source.postMessage({ 
        type: 'mbtilesExtractClearError',
        message: `Error clearing MBTiles cache: ${error.message}`
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