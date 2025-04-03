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

// External resources that should be cached on install
const EXTERNAL_RESOURCES = [
    // External libraries, fonts and resources
    'https://cdn.jsdelivr.net/npm/maplibre-gl@latest/dist/maplibre-gl.js',
    'https://cdn.jsdelivr.net/npm/maplibre-gl@latest/dist/maplibre-gl.css',
    'https://fonts.googleapis.com/icon?family=Material+Icons',
    'https://demotiles.maplibre.org/font/Open%20Sans%20Regular,Arial%20Unicode%20MS%20Regular/0-255.pbf',
    'https://demotiles.maplibre.org/font/Open%20Sans%20Regular,Arial%20Unicode%20MS%20Regular/256-511.pbf',
    // Airspace data via proxy
    PROXIED_AIRSPACE_URL
];

// Initial resources to cache on install - includes all files needed for offline functionality
const INITIAL_CACHE_RESOURCES = [
    // HTML files
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
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
            .then(cache => cache.addAll(INITIAL_CACHE_RESOURCES))
            .catch(error => console.error('Install cache failed:', error))
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
        
        // Filter to only include core files that match INITIAL_CACHE_RESOURCES
        // but exclude external resources (those with full URLs)
        const coreFilesPatterns = INITIAL_CACHE_RESOURCES
            .filter(url => !url.startsWith('http'))  // Exclude external resources
            .map(url => {
                // Extract filename from the path
                const parts = url.split('/');
                return parts[parts.length - 1];
            })
            .filter(filename => 
                filename.endsWith('.js') || 
                filename.endsWith('.html') || 
                filename.endsWith('.css') || 
                filename.endsWith('.json')
            );
        
        // Get all cached requests
        const cachedRequests = await cache.keys();
        
        // Filter to only include core files that match our patterns
        const coreFiles = cachedRequests.filter(request => {
            const url = new URL(request.url);
            const pathname = url.pathname;
            const filename = pathname.split('/').pop();
            
            // Only include files that are in our core files list
            return coreFilesPatterns.includes(filename);
        });
        
        console.log(`SW - Found ${coreFiles.length} core files to collect ETags for`);
        
        // Process files in batches to prevent overwhelming the browser
        const etags = [];
        const batchSize = 10;
        
        for (let i = 0; i < coreFiles.length; i += batchSize) {
            const batch = coreFiles.slice(i, i + batchSize);
            // Open cache once per batch
            const batchCache = await caches.open(CACHE_NAME);
            
            await Promise.all(batch.map(async (request) => {
                try {
                    const response = await batchCache.match(request);
                    
                    if (!response) {
                        return;
                    }
                    
                    // Extract filename from URL
                    const url = new URL(request.url);
                    const filename = url.pathname.split('/').pop();
                    
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
        
        // Send the combined ETags to all clients
        const combinedETag = etags.sort().join('|');
        console.log(`SW - Collected ${etags.length} ETags, created combined value`);
        
        // Broadcast ETags to all clients in one operation
        const allClients = await self.clients.matchAll();
        const message = {
            type: 'coreFilesETags',
            data: { combinedETag }
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

    // Special handling for our proxied airspace URL
    if (event.request.url.includes(PROXY_URL) && 
        event.request.url.includes(encodeURIComponent(AIRSPACE_URL))) {
        event.respondWith(
            caches.match(PROXIED_AIRSPACE_URL)
                .then(response => {
                    if (response) {
                        // Return the cached response if we have it
                        console.log('SW - Serving cached airspace data');
                        return response;
                    }
                    
                    // If not in cache, fetch from network and cache it
                    console.log('SW - Fetching airspace data from network');
                    return fetch(event.request)
                        .then(networkResponse => {
                            if (!networkResponse || networkResponse.status !== 200) {
                                return networkResponse;
                            }
                            
                            // Cache the response
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(PROXIED_AIRSPACE_URL, responseToCache);
                                    console.log('SW - Airspace data cached');
                                });
                            
                            return networkResponse;
                        });
                })
        );
        return;
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

    // Handle the fetch event
    event.respondWith(
        caches.match(event.request).then(response => {
            // Return cached response if found
            if (response) {
                return response;
            }

            // Otherwise fetch from network
            return fetch(event.request).then(networkResponse => {
                // Don't cache opaque responses or errors
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
                    return networkResponse;
                }

                // Clone the response to cache it and return it
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            });
        })
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
                    
                    const response = await fetch(file);
                    if (response.ok) {
                        await cache.put(file, response);
                        successCount++;
                        
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
    
    // Update app files message handler
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
        
        // Download and update each file directly
        let completed = 0;
        let failed = false;
        
        try {
            const cache = await caches.open(CACHE_NAME);
            
            for (const file of filesToUpdate) {
                try {
                    // Form the full URL
                    const url = new URL(file, self.location.origin).href;
                    
                    sendMessageToClients({
                        type: 'appUpdateProgress',
                        message: `Updating: ${file}`,
                        completed: completed,
                        total: filesToUpdate.length,
                        currentFile: file
                    });
                    
                    // For HTML files, add a cache-busting query parameter
                    let fetchUrl = url;
                    if (file.endsWith('.html')) {
                        fetchUrl = new URL(url);
                        fetchUrl.searchParams.set('update', Date.now());
                        fetchUrl = fetchUrl.toString();
                        console.log(`SW - Using cache-busting URL for HTML: ${fetchUrl}`);
                    }
                    
                    // Download the file fresh from network (no cache)
                    const response = await fetch(fetchUrl, { cache: 'no-store' });
                    
                    if (response.ok) {
                        // Put the file directly into the cache
                        await cache.put(url, response);
                        completed++;
                        
                        sendMessageToClients({
                            type: 'appUpdateProgress',
                            message: `Updated: ${file}`,
                            completed: completed,
                            total: filesToUpdate.length,
                            currentFile: file
                        });
                    } else {
                        failed = true;
                        console.error(`SW - Download failed: ${url} - ${response.status} ${response.statusText}`);
                        sendMessageToClients({
                            type: 'appUpdateError',
                            message: `Failed to download ${file}: ${response.status} ${response.statusText}`
                        });
                        break; // Stop on first failure
                    }
                } catch (error) {
                    failed = true;
                    console.error(`SW - Download error: ${file} - ${error.message}`);
                    sendMessageToClients({
                        type: 'appUpdateError',
                        message: `Failed to download ${file}: ${error.message}`
                    });
                    break; // Stop on first failure
                }
            }
            
            if (!failed) {
                // Keep track of what types of files were updated
                const updatedFiles = filesToUpdate.slice(0);
                
                // Notify completion
                sendMessageToClients({
                    type: 'appUpdateComplete',
                    message: `Successfully updated ${filesToUpdate.length} app files`,
                    needsReload: true,
                    updatedFiles: updatedFiles
                });
            } else {
                sendMessageToClients({
                    type: 'appUpdateFailed',
                    message: 'Update aborted: Some files could not be downloaded. Your app is unchanged.'
                });
            }
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