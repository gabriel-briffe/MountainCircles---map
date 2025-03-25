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
    
    // JS files
    `${BASE_PATH}/airspace.js`,
    `${BASE_PATH}/airspaceStyle.js`,
    `${BASE_PATH}/appUpdate.js`,
    `${BASE_PATH}/cacheConfig.js`,
    `${BASE_PATH}/cacheEdl.js`,
    `${BASE_PATH}/cacheTiles.js`,
    `${BASE_PATH}/cleanInstall.js`,
    `${BASE_PATH}/config.js`,
    `${BASE_PATH}/coreFiles.js`,
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
    `${BASE_PATH}/sidebar.js`,
    `${BASE_PATH}/state.js`,
    `${BASE_PATH}/sw.js`,
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
    self.clients.claim();
});

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