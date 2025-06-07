// Service Worker File: sw.js

/**
 * MountainCircles Map Service Worker
 * Caching Strategy:
 * - Single cache for all app files
 * - Files are cached indefinitely with no expiration
 * - Users must manually trigger updates via the "Update App" button
 */

// Single cache name for all app resources
const CACHE_NAME = 'mountaincircles-cache';

// Tile cache name - kept separate to support more specific caching
const TILE_CACHE_NAME = 'mountaincircles-tiles-v1';

// Directory structure for better organization
const CORE_FILES_DIR = '/coreFiles/';
const EXTERNAL_RESOURCES_DIR = '/externalResources/';

// Airspace data URL that should be cached
const AIRSPACE_URL = 'https://github.com/gabriel-briffe/openaip_airspace/releases/latest/download/airspace.geojson';
const PROXY_URL = 'https://edl-proxy.gabriel-briffe.workers.dev/?url=';
const PROXIED_AIRSPACE_URL = `${PROXY_URL}${encodeURIComponent(AIRSPACE_URL)}`;

// Import BASE_PATH from config
// Note: Since service workers run in a different context, 
// we'll need to determine this directly in the service worker
const BASE_PATH = getBasePath();

// Determine base path consistently
function getBasePath() {
    try {        
        // Check if on GitHub Pages site
            if (self.location.hostname === 'gabriel-briffe.github.io') {
        return '/MountainCircles---map';
    }

    // Check for Cloudflare Pages custom domain
    if (self.location.hostname === 'map.mountain-circles.org') {
        return '';  // Root path for custom domain
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

/**
 * Convert an original URL to a cache URL using the directory structure
 * @param {string|URL} url - The original URL
 * @returns {string} - The cache URL path
 */
function getCacheUrl(url) {
    const urlObj = typeof url === 'string' ? new URL(url, self.location.origin) : url;
    const urlString = urlObj.toString();
    
    // Check if this URL is in our explicit external resources list
    const isExplicitExternalResource = EXTERNAL_RESOURCES.some(resource => 
        resource === urlString || resource === urlString.split('?')[0]);
    
    // Extract filename
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    
    // Core files based on extension (only our local files)
    if (urlObj.origin === self.location.origin && 
        filename.match(/\.(js|html|css|json)$/)) {
        return `${CORE_FILES_DIR}${filename}`;
    }
    
    // Explicit external resources
    if (isExplicitExternalResource) {
        // Create a path based on hostname and pathname for organization
        const hostPath = urlObj.hostname.replace(/[^\w-]/g, '_');
        const pathPart = pathname.replace(/^\//, '').replace(/\//g, '_');
        return `${EXTERNAL_RESOURCES_DIR}${hostPath}_${pathPart}`;
    }
    
    // Data files from data.mountain-circles.org - preserve original URL for cache consistency
    if (urlObj.hostname === 'data.mountain-circles.org') {
        return urlString;
    }
    
    // All other resources (including proxy) - use original path to avoid translation issues
    return pathname;
}

// External resources that should be cached on install
const EXTERNAL_RESOURCES = [
    // External libraries, fonts and resources
    'https://cdn.jsdelivr.net/npm/maplibre-gl@latest/dist/maplibre-gl.js',
    'https://cdn.jsdelivr.net/npm/maplibre-gl@latest/dist/maplibre-gl.css',
    'https://fonts.googleapis.com/icon?family=Material+Icons',
    'https://demotiles.maplibre.org/font/Open%20Sans%20Regular,Arial%20Unicode%20MS%20Regular/0-255.pbf',
    'https://demotiles.maplibre.org/font/Open%20Sans%20Regular,Arial%20Unicode%20MS%20Regular/256-511.pbf'
    // Airspace data via proxy - now handled separately
    // PROXIED_AIRSPACE_URL
];

// Initial resources to cache on install - includes all files needed for offline functionality
const INITIAL_CACHE_RESOURCES = [
    // HTML files
    `${BASE_PATH}/`,
    `${BASE_PATH}/manifest.json`,
    
    // CSS files
    `${BASE_PATH}/styles.css`,
    `${BASE_PATH}/airspacePopup.css`,
    `${BASE_PATH}/installPrompt.css`,
    `${BASE_PATH}/mapDock.css`,
    `${BASE_PATH}/menu.css`,
    `${BASE_PATH}/navbox.css`,
    `${BASE_PATH}/parameters.css`,
    `${BASE_PATH}/progressBar.css`,
    `${BASE_PATH}/secondaryDock.css`,
    `${BASE_PATH}/sidebar.css`,
    // JS files
    `${BASE_PATH}/airspace.js`,
    `${BASE_PATH}/airspaceStyle.js`,
    `${BASE_PATH}/cacheConfig.js`,
    `${BASE_PATH}/cacheEdl.js`,
    `${BASE_PATH}/cacheTiles.js`,
    `${BASE_PATH}/circlesUI.js`,
    `${BASE_PATH}/config.js`,
    `${BASE_PATH}/dock.js`,
    `${BASE_PATH}/edl.js`,
    `${BASE_PATH}/edlUI.js`,
    `${BASE_PATH}/igc.js`,
    `${BASE_PATH}/init.js`,
    `${BASE_PATH}/install.js`,
    `${BASE_PATH}/LayerManager.js`,
    `${BASE_PATH}/layers.js`,
    `${BASE_PATH}/layerStyles.js`,
    `${BASE_PATH}/location.js`,
    `${BASE_PATH}/main.js`,
    `${BASE_PATH}/map.js`,
    `${BASE_PATH}/mapInitializer.js`,
    `${BASE_PATH}/mappings.js`,
    `${BASE_PATH}/mbtiles.js`,
    `${BASE_PATH}/menu.js`,
    `${BASE_PATH}/navboxManager.js`,
    `${BASE_PATH}/notification.js`,
    `${BASE_PATH}/sidebar.js`,
    `${BASE_PATH}/state.js`,
    `${BASE_PATH}/sw.js`,
    `${BASE_PATH}/toggleManager.js`,
    `${BASE_PATH}/tracking.js`,
    `${BASE_PATH}/utils.js`,
    `${BASE_PATH}/updateChecker.js`,
    `${BASE_PATH}/updateNotifier.js`,
    
    // GeoJSON data files
    `${BASE_PATH}/peaks.geojson`,
    `${BASE_PATH}/passes.geojson`,
    
    // Icons
    `${BASE_PATH}/icons/icon-192.png`,
    
    // External resources
    ...EXTERNAL_RESOURCES
];

// Install event - cache initial resources
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                console.log('SW - Caching initial resources with directory structure');
                
                try {
                    // Process each resource with proper directory structure
                    for (const resource of INITIAL_CACHE_RESOURCES) {
                        try {
                            // Fetch the resource using original URL
                            const response = await fetch(resource, { cache: 'no-store' });
                            
                            if (!response.ok) {
                                console.warn(`SW - Failed to cache ${resource}: ${response.status} ${response.statusText}`);
                                continue;
                            }
                            
                            // Convert to cache URL using our function that respects the rules
                            const cacheUrl = getCacheUrl(resource);
                            
                            // Store with directory structure
                            await cache.put(new Request(cacheUrl), response);
                            console.log(`SW - Cached: ${resource} as ${cacheUrl}`);
                        } catch (error) {
                            console.error(`SW - Error caching ${resource}:`, error);
                        }
                    }
                    console.log('SW - Initial resources cached successfully with directory structure');
                } catch (error) {
                    console.error('SW - Failed to cache initial resources:', error);
                }
            })
    );
    self.skipWaiting();
});

// Activate event - claim clients immediately
self.addEventListener('activate', event => {
    console.log('SW - Activate event fired');
    
    // Claim clients immediately
    self.clients.claim();
    
    // Collect ETags for core files and send to clients
    event.waitUntil(collectAndSendCoreETags());
});

/**
 * Collect and combine ETags for all core files
 */
async function collectAndSendCoreETags() {
    try {
        // Get client references
        const clients = await self.clients.matchAll();
        if (clients.length === 0) {
            console.log('SW - No clients available to receive ETags');
            return;
        }
        
        console.log('SW - Collecting ETags for core files');
        
        // Get all the cached resource requests
        const cache = await caches.open(CACHE_NAME);
        
        // Get all cached requests
        const cachedRequests = await cache.keys();
        
        // Debug: Log all cached URLs to see what we have
        console.log('SW - All cached URLs:');
        cachedRequests.forEach(request => {
            const url = new URL(request.url);
            console.log(`SW - Cached: ${url.pathname}`);
        });
        
        // Filter to only include files in the core files directory and root page
        const coreRequests = cachedRequests.filter(request => {
            const url = new URL(request.url);
            const matches = url.pathname.startsWith(CORE_FILES_DIR) || 
                           url.pathname === `${BASE_PATH}/` ||
                           url.pathname === '/';
            
            if (matches) {
                console.log(`SW - Including in ETag collection: ${url.pathname}`);
            }
            
            return matches;
        });
        
        console.log(`SW - Found ${coreRequests.length} core files in directory to collect ETags for`);
        
        // Process files in batches to prevent overwhelming the browser
        const etags = [];
        const batchSize = 10;
        
        for (let i = 0; i < coreRequests.length; i += batchSize) {
            const batch = coreRequests.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (request) => {
                try {
                    const response = await cache.match(request);
                    
                    if (!response) {
                        return;
                    }
                    
                    // Extract filename from URL
                    const url = new URL(request.url);
                    let filename;
                    if (url.pathname.startsWith(CORE_FILES_DIR)) {
                        filename = url.pathname.replace(CORE_FILES_DIR, '');
                    } else if (url.pathname === `${BASE_PATH}/` || url.pathname === '/') {
                        // For root page, use index.html as identifier
                        filename = 'index.html';
                    } else {
                        // For other non-core files, use just the filename
                        filename = url.pathname.split('/').pop();
                    }
                    
                    // Prioritize Last-Modified header
                    const lastModified = response.headers.get('Last-Modified');
                    if (lastModified) {
                        etags.push(`${filename}:last-modified:${lastModified}`);
                        return;
                    }
                    
                    // Fallbacks in order of preference
                    const etag = response.headers.get('ETag');
                    if (etag) {
                        etags.push(`${filename}:${etag}`);
                        return;
                    }
                    
                    const contentLength = response.headers.get('Content-Length');
                    if (contentLength) {
                        etags.push(`${filename}:size:${contentLength}`);
                    }
                } catch (error) {
                    console.error(`SW - Error processing file ${request.url}:`, error);
                }
            }));
        }
        
        if (etags.length === 0) {
            console.warn('SW - No ETags collected for core files');
            return;
        }
        
        // Create a combined ETag string with all collected ETags
        const combinedETag = etags.sort().join('|');
        console.log(`SW - Collected ${etags.length} ETags, created combined value`);
        
        // Broadcast ETags to all clients in one operation
        const allClients = await self.clients.matchAll();
        const message = {
            type: 'coreFilesETags',
            data: { 
                combinedETag,
                replaceExisting: true // Flag to indicate this should replace existing ETags, not append
            }
        };
        
        allClients.forEach(client => client.postMessage(message));
        console.log(`SW - Sending core ETags to ${allClients.length} clients`);
    } catch (error) {
        console.error('SW - Error collecting and sending core ETags:', error);
    }
}

// Helper to send messages to clients
function sendMessageToClients(message) {
    self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage(message));
    });
}

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
    // Only handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Full URL object for analysis
    const url = new URL(event.request.url);
    
    // Never cache bootstrap.html - always fetch from network
    if (url.pathname.endsWith('/bootstrap.html')) {
        console.log('SW - Bypassing service worker for bootstrap.html');
        return; // Do not intercept, let the browser handle it directly
    }

    // Special handling for tile requests - explicitly check tile cache first, then network
    const isRegularTile = url.pathname.includes('/tiles/') && url.pathname.match(/\/\d+\/\d+\/\d+\.png$/);
    const isEdlTile = url.pathname.includes('/edl_tiles/') && url.pathname.match(/\/\d+\/\d+\/\d+\.png$/);
    
    if (isRegularTile || isEdlTile) {
        const tileType = isRegularTile ? 'regular' : 'EDL';
        
        event.respondWith(
            // Explicitly check the tile cache first
            caches.open(TILE_CACHE_NAME)
                .then(tileCache => tileCache.match(event.request))
                .then(response => {
                    if (response) {
                        // Return the cached tile if we have it
                        console.log(`SW - Serving ${tileType} tile from tile cache: ${url.pathname}`);
                        return response;
                    }
                    
                    // For regular tiles (custom server tiles), don't fetch from network if not in cache
                    // This allows the map to fall back to OSM tiles instead
                    if (isRegularTile) {
                        console.log(`SW - ${tileType} tile not in cache, returning 404 to trigger OSM fallback: ${url.pathname}`);
                        return new Response('', { status: 404, statusText: 'Tile not in cache' });
                    }
                    
                    // For EDL tiles, still try to fetch from network as they're dynamic
                    console.log(`SW - ${tileType} tile not in cache, fetching from network: ${event.request.url}`);
                    return fetch(event.request)
                        .then(networkResponse => {
                            if (!networkResponse || networkResponse.status !== 200) {
                                return networkResponse;
                            }
                            
                            // Cache the response in the tile cache
                            const responseToCache = networkResponse.clone();
                            caches.open(TILE_CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                    console.log(`SW - ${tileType} tile cached in tile cache: ${url.pathname}`);
                                });
                            
                            return networkResponse;
                        });
                })
                .catch(error => {
                    console.error(`SW - Error fetching ${tileType} tile: ${error.message}`);
                    // For regular tiles, return 404 instead of trying to fetch
                    if (isRegularTile) {
                        return new Response('', { status: 404, statusText: 'Tile fetch error' });
                    }
                    return fetch(event.request);
                })
        );
        return;
    }

    // Special handling for our proxied airspace URL
    if (event.request.url.includes(PROXY_URL) && 
        event.request.url.includes(encodeURIComponent(AIRSPACE_URL))) {
        
        // Simple airspace cache path in the root
        const airspaceCacheUrl = `${BASE_PATH}/airspace.geojson`;
        
        event.respondWith(
            caches.match(airspaceCacheUrl)
                .then(response => {
                    if (response) {
                        // Return the cached response if we have it
                        console.log(`SW - Serving cached airspace data from: ${airspaceCacheUrl}`);
                        return response;
                    }
                    
                    // If not in cache, fetch from network using original URL
                    console.log('SW - Fetching airspace data from network using original URL');
                    return fetch(event.request)
                        .then(networkResponse => {
                            if (!networkResponse || networkResponse.status !== 200) {
                                return networkResponse;
                            }
                            
                            // Cache the response with simple URL
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(airspaceCacheUrl, responseToCache);
                                    console.log(`SW - Airspace data cached as: ${airspaceCacheUrl}`);
                                });
                            
                            return networkResponse;
                        });
                })
        );
        return;
    }

    // Handle R2 data custom domain URLs with cache-first behavior
    if (url.hostname === 'data.mountain-circles.org') {
        event.respondWith(
            (async () => {
                try {
                    const cache = await caches.open(CACHE_NAME);
                    
                    // Check cache first
                    const cachedResponse = await cache.match(event.request);
                    if (cachedResponse) {
                        console.log(`SW - Serving R2 data from cache: ${event.request.url}`);
                        return cachedResponse;
                    }
                    
                    // If not in cache, fetch from network
                    console.log(`SW - Fetching R2 data from network: ${event.request.url}`);
                    const networkResponse = await fetch(event.request);
                    
                    if (networkResponse && networkResponse.status === 200) {
                        // Cache the response
                        const responseToCache = networkResponse.clone();
                        await cache.put(event.request, responseToCache);
                        console.log(`SW - Cached R2 data: ${event.request.url}`);
                    }
                    
                    return networkResponse;
                } catch (error) {
                    console.error(`SW - Error handling R2 data request: ${event.request.url}`, error);
                    return fetch(event.request);
                }
            })()
        );
        return;
    }

    // Handle EDL proxy URLs (only for airspace now)
    if (url.hostname === 'edl-proxy.gabriel-briffe.workers.dev') {
        const isAirspaceUrl = event.request.url.includes(encodeURIComponent(AIRSPACE_URL));
        
        if (!isAirspaceUrl) {
            console.log(`SW - Bypassing service worker for non-airspace proxy URL: ${url.href}`);
            return; // Do not intercept non-airspace proxy URLs
        }
        
        // Continue with existing airspace handling
    }

    // Check if this request should be intercepted by the service worker
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

    // Handle the fetch event for core files and other resources
    event.respondWith(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                
                // Convert the requested URL to a cache URL for core files
                const cacheUrl = getCacheUrl(url);
                
                // Check if we have the resource in cache
                const cachedResponse = await cache.match(new Request(cacheUrl));
                if (cachedResponse) {
                    console.log(`SW - Serving from cache: ${cacheUrl}`);
                    return cachedResponse;
                }
                
                // If not in cache, try to fetch from network using original URL
                console.log(`SW - Fetching from network using original URL: ${event.request.url}`);
                const networkResponse = await fetch(event.request);
                
                // Don't cache opaque responses or errors
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
                    return networkResponse;
                }
                
                // Cache the response with the directory structure
                const responseToCache = networkResponse.clone();
                console.log(`SW - Caching response as: ${cacheUrl}`);
                
                // Store in cache with directory structure
                await cache.put(new Request(cacheUrl), responseToCache);
                
                return networkResponse;
            } catch (error) {
                console.error(`SW - Fetch error for ${event.request.url}:`, error);
                // If everything fails, just try to fetch from network and return whatever we get
                return fetch(event.request);
            }
        })()
    );
});

// Message handler for various operations
self.addEventListener('message', async (event) => {
    // Message to cache specific files during initial setup
    if (event.data.type === 'cacheFiles') {
        const files = event.data.files;
        const cacheKey = event.data.cacheKey || CACHE_NAME;
        let successCount = 0;
        let errorCount = 0;
        
        try {
            // Notify clients that caching has started
            sendMessageToClients({
                type: 'cacheStart',
                total: files.length
            });
            
            const cache = await caches.open(cacheKey);
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    // Send progress update
                    sendMessageToClients({
                        type: 'cacheProgress',
                        completed: i,
                        total: files.length,
                        currentFile: file
                    });
                    
                    // Fetch the file using original URL
                    const response = await fetch(file);
                    if (response.ok) {
                        // Get appropriate cache URL (only transforms core files and explicit external resources)
                        const cacheUrl = getCacheUrl(file);
                        
                        // For proxy URLs for MBTiles, use the original URL to prevent issues
                        const isProxyUrl = file.includes(PROXY_URL);
                        const isAirspaceUrl = isProxyUrl && file.includes(encodeURIComponent(AIRSPACE_URL));

                        let cacheRequest;
                        if (isAirspaceUrl) {
                            // Special case for airspace - use the fixed cache path
                            cacheRequest = new Request(`${BASE_PATH}/airspace.geojson`);
                            console.log(`SW - Using fixed cache path for airspace: ${cacheRequest.url}`);
                        } else if (isProxyUrl) {
                            // Other proxy URLs - use original to prevent issues
                            cacheRequest = new Request(file);
                            console.log(`SW - Using original URL for proxy request: ${file}`);
                        } else {
                            // Normal resources - use directory structure
                            cacheRequest = new Request(cacheUrl);
                        }

                        // Store in cache with appropriate URL
                        await cache.put(cacheRequest, response);
                        successCount++;
                        
                        console.log(`SW - Cached file: ${file} as ${cacheRequest.url}`);
                        
                        // Send updated progress
                        sendMessageToClients({
                            type: 'cacheProgress',
                            completed: successCount,
                            total: files.length,
                            currentFile: file
                        });
                    } else {
                        errorCount++;
                        console.error(`SW - Failed to cache file: ${file} (${response.status})`);
                    }
                } catch (error) {
                    errorCount++;
                    console.error(`SW - Error caching file: ${file}`, error);
                }
            }
            
            // Send completion message
            sendMessageToClients({
                type: 'cacheComplete',
                successCount,
                errorCount,
                total: files.length
            });
            
            // Also send response directly to the caller
            event.source.postMessage({
                type: 'cacheFilesComplete',
                successCount,
                errorCount,
                total: files.length
            });
        } catch (error) {
            console.error('SW - Error opening cache:', error);
            
            // Send error message to all clients
            sendMessageToClients({
                type: 'cacheError',
                error: error.message
            });
            
            // Also send to original caller
            event.source.postMessage({
                type: 'cacheFilesError',
                error: error.message
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