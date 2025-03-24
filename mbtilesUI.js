/**
 * MBTiles UI Components
 * Provides UI elements for MBTiles extraction and management
 */

import { getBasePath } from './utils.js';
// Use dynamic import for mbtilesHandler to avoid circular references

/**
 * Initialize the MBTiles UI components needed for MBTiles extraction
 * This is a simplified version that only creates the progress container
 */
export function initMBTilesUI() {
    console.log('[DEBUG] Starting MBTiles UI initialization');
    
    // Create progress container if it doesn't exist
    let progressContainer = document.getElementById('mbtilesProgressContainer');
    if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.id = 'mbtilesProgressContainer';
        progressContainer.className = 'mbtiles-progress-container';
        progressContainer.style.display = 'none';
        progressContainer.innerHTML = `
            <div class="mbtiles-progress-box">
                <div class="mbtiles-progress-title">Extracting Map Tiles</div>
                <div class="mbtiles-progress-bar-container">
                    <div id="mbtilesProgressBar" class="mbtiles-progress-bar"></div>
                </div>
                <div class="mbtiles-progress-status" id="mbtilesStatus">Preparing...</div>
                <div class="mbtiles-progress-count">
                    <span id="mbtilesProcessed">0</span> / <span id="mbtilesTotal">0</span> tiles
                </div>
            </div>
        `;
        document.body.appendChild(progressContainer);
        console.log('[DEBUG] MBTiles progress container added to body');
    }
    
    // Set up an event listener for the file upload input if it exists
    const fileInput = document.getElementById('mbtilesFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleMBTilesFileUpload);
        console.log('[DEBUG] Added file upload handler for MBTiles');
    }
}

/**
 * Checks the status of MBTiles cache
 * @returns {Promise<Object>} Cache status
 */
async function checkMBTilesCacheStatus() {
    try {
        if ('caches' in window) {
            const cache = await caches.open('mbtiles-cache');
            const keys = await cache.keys();
            const count = keys.length;
            
            console.log(`[DEBUG] MBTiles cache contains ${count} tiles`);
            return { 
                exists: count > 0,
                count: count
            };
        }
        return { exists: false, count: 0 };
    } catch (error) {
        console.error('[DEBUG] Error checking MBTiles cache status:', error);
        return { exists: false, count: 0, error };
    }
}

/**
 * Handle the MBTiles extraction process
 */
export async function handleMBTilesExtraction() {
    console.log('[DEBUG] MBTiles extraction button clicked');
    
    // Use the map cache progress UI instead of the MBTiles-specific one
    const progressElement = document.getElementById('mapCacheProgress');
    const progressBar = document.getElementById('mapProgressBar');
    const processedElement = document.getElementById('mapCacheCount');
    const totalElement = document.getElementById('mapTotalTiles');
    let statusElement = document.createElement('div');
    statusElement.style.marginBottom = '5px';
    statusElement.textContent = 'Preparing download...';
    
    // Add status element before the progress bar if it doesn't exist
    if (progressElement.querySelector('.status-text') === null) {
        const existingText = progressElement.querySelector('div');
        if (existingText) {
            progressElement.insertBefore(statusElement, existingText);
        } else {
            progressElement.prepend(statusElement);
        }
        statusElement.className = 'status-text';
    } else {
        statusElement = progressElement.querySelector('.status-text');
    }

    if (!progressElement || !progressBar || !processedElement || !totalElement) {
        console.error('[DEBUG] Map progress elements not found');
        return;
    }
    
    progressElement.style.display = 'block';
    progressBar.style.width = '0%';
    processedElement.textContent = '0';
    totalElement.textContent = 'Calculating...';
    
    try {
        // Check if we need to clear existing cache
        if ('caches' in window) {
            console.log('[DEBUG] Checking existing cache before extraction');
            const cache = await caches.open('mbtiles-cache');
            const keys = await cache.keys();
            
            if (keys.length > 0) {
                console.log('[DEBUG] Clearing existing MBTiles cache');
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'clearMBTilesCache'
                    });
                }
                await cache.keys().then(keys => Promise.all(keys.map(key => cache.delete(key))));
                console.log('[DEBUG] Existing MBTiles cache cleared');
            }
        }
        
        // Dynamically import the handler to avoid circular references
        console.log('[DEBUG] Dynamically importing mbtilesHandler module');
        const mbtilesHandlerModule = await import('./mbtilesHandler.js');
        const mbtilesHandler = mbtilesHandlerModule.default;
        
        if (!mbtilesHandler) {
            throw new Error('Could not load mbtilesHandler module');
        }
        
        // Track which phase we're in
        let phase = 'download'; // 'download' or 'extraction'
        
        // Define download progress callback
        const downloadProgressCallback = (progress, current, total, message) => {
            if (phase === 'download') {
                progressBar.style.width = `${progress * 100}%`;
                processedElement.textContent = current;
                totalElement.textContent = total;
                statusElement.textContent = message || 'Downloading map data...';
                console.log(`[DEBUG] Download progress: ${Math.floor(progress * 100)}% (${current}/${total})`);
            }
        };
        
        // Initialize the MBTiles handler with progress tracking
        console.log('[DEBUG] Loading MBTiles file...');
        const initSuccess = await mbtilesHandler.initialize(downloadProgressCallback);
        
        if (!initSuccess) {
            // If initialization failed, check if the file exists in a different location
            console.log('[DEBUG] Initial MBTiles initialization failed, checking alternative paths');
            
            // Try a few alternative paths
            const basePath = getBasePath();
            const alternativePaths = [
                `${basePath}/hillshaded_alps.mbtiles`,
                './hillshaded_alps.mbtiles',
                '/hillshaded_alps.mbtiles',
                `${window.location.origin}/hillshaded_alps.mbtiles`
            ];
            
            let foundPath = false;
            for (const path of alternativePaths) {
                if (path === mbtilesHandler.mbtilesPath) continue; // Skip the path we already tried
                
                console.log(`[DEBUG] Trying alternative path: ${path}`);
                
                try {
                    const response = await fetch(path, { method: 'HEAD' });
                    if (response.ok) {
                        console.log(`[DEBUG] Found MBTiles at: ${path}`);
                        mbtilesHandler.mbtilesPath = path;
                        const retrySuccess = await mbtilesHandler.initialize(downloadProgressCallback);
                        if (retrySuccess) {
                            foundPath = true;
                            break;
                        }
                    }
                } catch (e) {
                    console.log(`[DEBUG] Path failed: ${path}`, e);
                }
            }
            
            if (!foundPath) {
                throw new Error('Failed to locate MBTiles file. Please verify the file exists.');
            }
        }
        
        // Switch to extraction phase
        phase = 'extraction';
        statusElement.textContent = 'Extracting map tiles...';
        progressBar.style.width = '0%';
        
        // Start extraction process
        console.log('[DEBUG] Starting MBTiles extraction process');
        
        // Set total if known
        if (mbtilesHandler.totalTiles) {
            totalElement.textContent = mbtilesHandler.totalTiles;
        } else {
            totalElement.textContent = 'Calculating...';
        }
        
        // Progress callback for extraction phase
        const extractionProgressCallback = (progress, processed, total) => {
            if (phase === 'extraction') {
                progressBar.style.width = `${progress * 100}%`;
                processedElement.textContent = processed;
                totalElement.textContent = total;
                statusElement.textContent = `Extracting map tiles: ${Math.floor(progress * 100)}%`;
                console.log(`[DEBUG] Extraction progress: ${Math.floor(progress * 100)}% (${processed}/${total})`);
            }
        };
        
        // Extract tiles - this will use the service worker to cache them
        await mbtilesHandler.extractAndCacheTiles(extractionProgressCallback);
        
        // Close the database connection
        mbtilesHandler.close();
        
        // Update status
        statusElement.textContent = 'Extraction complete!';
        
        // Refresh the map using the new tiles
        console.log('[DEBUG] Extraction complete, refreshing map...');
        window.dispatchEvent(new CustomEvent('mbtilesExtracted'));
        
        // Hide progress after a moment
        setTimeout(() => {
            progressElement.style.display = 'none';
            
            // Show confirmation message
            alert('Map tiles have been successfully extracted and are now available offline.');
        }, 2000);
        
        return { success: true };
    } catch (error) {
        console.error('[DEBUG] Error during MBTiles extraction:', error);
        
        // Hide progress after error
        progressElement.style.display = 'none';
        progressBar.style.width = '0%';
        
        throw error; // Re-throw to let the calling function handle the error
    }
}

/**
 * Build a consistent tile URL using the correct base path
 * @param {number} z - Zoom level
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {string} - Properly formatted tile URL
 */
function buildTileUrl(z, x, y) {
    const basePath = getBasePath();
    
    // Ensure consistent URL format for tile paths
    // This helps with caching by ensuring all references to the same tile use the same URL
    let url = `${basePath}/tiles/${z}/${x}/${y}.png`;
    
    // Apply additional normalization to avoid common path problems
    // 1. Remove any double slashes (except in protocol)
    url = url.replace(/([^:])\/\//g, '$1/');
    
    // 2. Ensure no 'index.html' in the path
    url = url.replace(/\/index\.html\//, '/');
    
    // 3. Add domain if it's a relative path and we're in a browser
    if (url.startsWith('.') && typeof window !== 'undefined') {
        url = `${window.location.origin}${url.substring(1)}`;
    }
    
    console.log(`[DEBUG] Built tile URL: ${url} from z=${z}, x=${x}, y=${y}`);
    return url;
}

/**
 * Updates the map style to use the MBTiles-based source
 * @param {Object} map - The MapLibre map instance
 */
export function updateMapStyleForMBTiles(map) {
    console.log('[DEBUG] updateMapStyleForMBTiles called');
    // Ensure the map uses the cached MBTiles tiles
    if (map && map.getStyle()) {
        try {
            console.log('[DEBUG] Map and style exist, proceeding with update');
            const style = map.getStyle();
            const basePath = getBasePath();
            console.log(`[DEBUG] Using base path: ${basePath}`);
            
            // Check if we already have the proper layer
            const hasLayer = map.getLayer('mbtiles-layer');
            console.log(`[DEBUG] mbtiles-layer exists: ${hasLayer ? 'yes' : 'no'}`);
            if (hasLayer) {
                console.log('[DEBUG] MBTiles layer already exists, skipping creation');
                return;
            }
            
            // Add or update our custom tile source
            const hasSource = map.getSource('mbtiles-source');
            console.log(`[DEBUG] mbtiles-source exists: ${hasSource ? 'yes' : 'no'}`);
            if (hasSource) {
                console.log('[DEBUG] Removing existing mbtiles-source');
                map.removeSource('mbtiles-source');
            }
            
            // Build the tile URL template using the same function for consistency
            const tileUrlTemplate = `${basePath}/tiles/{z}/{x}/{y}.png`;
            console.log(`[DEBUG] Using tile URL template: ${tileUrlTemplate}`);
            
            console.log('[DEBUG] Adding mbtiles-source');
            map.addSource('mbtiles-source', {
                type: 'raster',
                tiles: [tileUrlTemplate],
                tileSize: 256,
                maxzoom: 18,
                attribution: "Custom imported MBTiles"
            });
            
            // Add our layer as the bottom-most layer
            // This is important to ensure it's behind all other layers
            const firstLayerId = style.layers[0].id;
            console.log(`[DEBUG] First layer ID: ${firstLayerId}`);
            
            // If there's an existing custom-tiles layer, we want to hide it
            const hasCustomTiles = map.getLayer('custom-tiles');
            console.log(`[DEBUG] custom-tiles layer exists: ${hasCustomTiles ? 'yes' : 'no'}`);
            if (hasCustomTiles) {
                console.log('[DEBUG] Setting custom-tiles to hidden');
                map.setLayoutProperty('custom-tiles', 'visibility', 'none');
            }
            
            // Now add our mbtiles layer
            console.log('[DEBUG] Adding mbtiles-layer before', firstLayerId);
            map.addLayer({
                id: 'mbtiles-layer',
                type: 'raster',
                source: 'mbtiles-source',
                minzoom: 0,
                maxzoom: 22
            }, firstLayerId);
            
            console.log('[DEBUG] MBTiles layer added successfully');
            
        } catch (error) {
            console.error('[DEBUG] Error updating map style for MBTiles:', error);
            
            // Fallback: ensure the original custom-tiles layer is visible
            try {
                console.log('[DEBUG] Attempting fallback to custom-tiles layer');
                if (map.getLayer('custom-tiles')) {
                    console.log('[DEBUG] Setting custom-tiles to visible');
                    map.setLayoutProperty('custom-tiles', 'visibility', 'visible');
                }
            } catch (fallbackError) {
                console.error('[DEBUG] Error setting fallback layer visibility:', fallbackError);
            }
        }
    } else {
        console.error('[DEBUG] Map or style not available');
    }
}

/**
 * Handle MBTiles file uploaded by the user
 * @param {Event} event - Change event from file input
 */
async function handleMBTilesFileUpload(event) {
    console.log('[DEBUG] MBTiles file upload handler triggered');
    const file = event.target.files[0];
    if (!file) {
        console.log('[DEBUG] No file selected');
        return;
    }
    
    console.log(`[DEBUG] File selected: ${file.name}, size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
    
    // Show progress container
    const progressContainer = document.getElementById('mbtilesProgressContainer');
    const progressBar = document.getElementById('mbtilesProgressBar');
    const processedElement = document.getElementById('mbtilesProcessed');
    const totalElement = document.getElementById('mbtilesTotal');
    const statusElement = document.getElementById('mbtilesStatus');
    
    if (!progressContainer || !progressBar || !processedElement || !totalElement || !statusElement) {
        console.error('[DEBUG] Progress elements not found');
        return;
    }
    
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    statusElement.textContent = 'Reading uploaded file...';
    
    try {
        // Clear existing cache
        if ('caches' in window) {
            const cache = await caches.open('mbtiles-cache');
            const keys = await cache.keys();
            
            if (keys.length > 0) {
                statusElement.textContent = 'Clearing existing cache...';
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'clearMBTilesCache'
                    });
                }
                await cache.keys().then(keys => Promise.all(keys.map(key => cache.delete(key))));
                statusElement.textContent = 'Existing cache cleared...';
            }
        }
        
        // Initialize SQL.js
        statusElement.textContent = 'Initializing SQL.js...';
        console.log('[DEBUG] Initializing SQL.js for uploaded file');
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        
        // Read the file
        statusElement.textContent = 'Reading MBTiles file...';
        const reader = new FileReader();
        
        const fileContents = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
        
        console.log(`[DEBUG] File read into memory, size: ${(fileContents.byteLength / (1024 * 1024)).toFixed(2)} MB`);
        
        // Create database from file
        statusElement.textContent = 'Processing MBTiles file...';
        const db = new SQL.Database(new Uint8Array(fileContents));
        
        // Check if this is a valid MBTiles file
        try {
            const metadataStmt = db.prepare("SELECT name, value FROM metadata WHERE name IN ('name', 'format')");
            let hasValidMetadata = false;
            while (metadataStmt.step()) {
                hasValidMetadata = true;
                const row = metadataStmt.getAsObject();
                console.log(`[DEBUG] MBTiles metadata: ${row.name}=${row.value}`);
            }
            metadataStmt.free();
            
            if (!hasValidMetadata) {
                throw new Error('Invalid MBTiles file: missing required metadata');
            }
        } catch (error) {
            throw new Error(`Invalid MBTiles file: ${error.message}`);
        }
        
        // Count total tiles
        const countStmt = db.prepare("SELECT COUNT(*) as count FROM tiles");
        countStmt.step();
        const totalTiles = countStmt.getAsObject().count;
        countStmt.free();
        
        console.log(`[DEBUG] Total tiles in uploaded MBTiles: ${totalTiles}`);
        totalElement.textContent = totalTiles;
        
        // Start extraction process
        statusElement.textContent = 'Starting extraction...';
        let processed = 0;
        
        // Get all tiles and cache them
        const tilesStmt = db.prepare("SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles");
        const basePath = getBasePath();
        console.log(`[DEBUG] Using basePath for tile URLs: ${basePath}`);
        
        while (tilesStmt.step()) {
            const row = tilesStmt.getAsObject();
            const z = row.zoom_level;
            const x = row.tile_column;
            // Convert from TMS to XYZ coordinates (flip Y)
            const y = Math.pow(2, z) - 1 - row.tile_row;
            const tileData = row.tile_data;
            
            // Create a blob from the tile data
            const blob = new Blob([tileData], { type: 'image/png' });
            
            // Create URL for the tile using the buildTileUrl function for consistency
            const url = buildTileUrl(z, x, y);
            console.log(`[DEBUG] Caching tile at URL: ${url} (z=${z}, x=${x}, y=${y})`);
            
            // Send to service worker to cache
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'cacheMBTilesTile',
                    url: url,
                    blob: blob
                });
            }
            
            processed++;
            
            // Update progress every 100 tiles or at the end
            if (processed % 100 === 0 || processed === totalTiles) {
                const progress = processed / totalTiles;
                progressBar.style.width = `${progress * 100}%`;
                processedElement.textContent = processed;
                statusElement.textContent = `Extracting... ${Math.floor(progress * 100)}%`;
                // Give time for UI update
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        tilesStmt.free();
        db.close();
        
        // Update button text
        const mbtilesButton = document.getElementById('mbtilesExtractButton');
        if (mbtilesButton) {
            mbtilesButton.querySelector('span:last-child').textContent = 'Reload Map Tiles';
        }
        
        // Show completion message
        statusElement.textContent = 'Extraction complete!';
        
        // Refresh the map using the new tiles
        setTimeout(() => {
            statusElement.textContent = 'Refreshing map...';
            // Signal that map should be reloaded to use new tiles
            window.dispatchEvent(new CustomEvent('mbtilesExtracted'));
            
            // Hide progress after a moment
            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 2000);
        }, 1000);
    } catch (error) {
        console.error('[DEBUG] Error during MBTiles file upload processing:', error);
        statusElement.textContent = `Error: ${error.message}`;
        
        // Hide progress after error
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 5000);
    }
    
    // Reset file input
    event.target.value = '';
}

/**
 * Process an MBTiles file uploaded by the user
 * @param {File} file - The uploaded MBTiles file
 * @param {Object} uiElements - UI elements for progress tracking
 * @returns {Promise<boolean>} - Whether processing was successful
 */
export async function processUploadedMBTilesFile(file, uiElements) {
    const { progressElement, progressBar, cacheCount, totalTiles, statusText } = uiElements;
    
    console.log(`[DEBUG] Processing uploaded file: ${file.name}, size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
    
    try {
        // Clear existing cache
        if ('caches' in window) {
            statusText.textContent = 'Clearing existing cache...';
            const cache = await caches.open('mbtiles-cache');
            const keys = await cache.keys();
            
            if (keys.length > 0) {
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'clearMBTilesCache'
                    });
                }
                await cache.keys().then(keys => Promise.all(keys.map(key => cache.delete(key))));
                console.log('[DEBUG] Existing cache cleared');
            }
        }
        
        // Initialize SQL.js
        statusText.textContent = 'Initializing SQL.js...';
        console.log('[DEBUG] Initializing SQL.js for uploaded file');
        
        // Check if initSqlJs is defined
        let SQL;
        if (typeof initSqlJs === 'undefined') {
            // Load SQL.js dynamically if needed
            const sqlJsScript = document.createElement('script');
            sqlJsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
            await new Promise((resolve, reject) => {
                sqlJsScript.onload = resolve;
                sqlJsScript.onerror = () => reject(new Error('Failed to load SQL.js'));
                document.head.appendChild(sqlJsScript);
            });
            
            // Wait a brief moment for the script to initialize
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Initialize SQL.js
        SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        
        // Read the file
        statusText.textContent = 'Reading MBTiles file...';
        progressBar.style.width = '10%';
        const reader = new FileReader();
        
        const fileContents = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
        
        console.log(`[DEBUG] File read into memory, size: ${(fileContents.byteLength / (1024 * 1024)).toFixed(2)} MB`);
        progressBar.style.width = '20%';
        
        // Create database from file
        statusText.textContent = 'Opening MBTiles database...';
        const db = new SQL.Database(new Uint8Array(fileContents));
        progressBar.style.width = '30%';
        
        // Check if this is a valid MBTiles file
        try {
            statusText.textContent = 'Validating MBTiles format...';
            const metadataStmt = db.prepare("SELECT name, value FROM metadata WHERE name IN ('name', 'format', 'bounds')");
            let hasValidMetadata = false;
            let metadata = {};
            
            while (metadataStmt.step()) {
                hasValidMetadata = true;
                const row = metadataStmt.getAsObject();
                metadata[row.name] = row.value;
                console.log(`[DEBUG] MBTiles metadata: ${row.name}=${row.value}`);
            }
            metadataStmt.free();
            
            if (!hasValidMetadata || !metadata.format) {
                throw new Error('Invalid MBTiles file: missing required metadata');
            }
            
            // Show some metadata to the user
            if (metadata.name) {
                statusText.textContent = `Processing ${metadata.name}...`;
            }
        } catch (error) {
            throw new Error(`Invalid MBTiles file: ${error.message}`);
        }
        
        progressBar.style.width = '40%';
        
        // Count total tiles
        statusText.textContent = 'Counting tiles...';
        const countStmt = db.prepare("SELECT COUNT(*) as count FROM tiles");
        countStmt.step();
        const tileCount = countStmt.getAsObject().count;
        countStmt.free();
        
        console.log(`[DEBUG] Total tiles in uploaded MBTiles: ${tileCount}`);
        totalTiles.textContent = tileCount;
        cacheCount.textContent = '0';
        progressBar.style.width = '50%';
        
        // Get zoom level bounds for information
        try {
            const minZoomStmt = db.prepare("SELECT MIN(zoom_level) as min_zoom FROM tiles");
            minZoomStmt.step();
            const minZoom = minZoomStmt.getAsObject().min_zoom;
            minZoomStmt.free();
            
            const maxZoomStmt = db.prepare("SELECT MAX(zoom_level) as max_zoom FROM tiles");
            maxZoomStmt.step();
            const maxZoom = maxZoomStmt.getAsObject().max_zoom;
            maxZoomStmt.free();
            
            console.log(`[DEBUG] MBTiles zoom levels: min=${minZoom}, max=${maxZoom}`);
            statusText.textContent = `Processing zoom levels ${minZoom} to ${maxZoom}...`;
        } catch (error) {
            console.warn('[DEBUG] Error getting zoom bounds:', error);
        }
        
        // Start extraction process
        statusText.textContent = 'Extracting tiles...';
        let processed = 0;
        
        // Get all tiles and cache them
        const tilesStmt = db.prepare("SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles");
        const basePath = getBasePath();
        
        while (tilesStmt.step()) {
            const row = tilesStmt.getAsObject();
            const z = row.zoom_level;
            const x = row.tile_column;
            // Convert from TMS to XYZ coordinates (flip Y)
            const y = Math.pow(2, z) - 1 - row.tile_row;
            const tileData = row.tile_data;
            
            // Create a blob from the tile data
            const blob = new Blob([tileData], { type: 'image/png' });
            
            // Create URL for the tile using the buildTileUrl function for consistency
            const url = buildTileUrl(z, x, y);
            console.log(`[DEBUG] Caching tile at URL: ${url} (z=${z}, x=${x}, y=${y})`);
            
            // Cache the tile
            try {
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'cacheMBTilesTile',
                        url: url,
                        tileData: tileData, 
                        contentType: 'image/png'
                    });
                } else {
                    // Fallback if service worker is not controlling the page
                    const cache = await caches.open('mbtiles-cache');
                    const response = new Response(blob, { 
                        status: 200, 
                        headers: { 'Content-Type': 'image/png' }
                    });
                    await cache.put(url, response);
                }
            } catch (error) {
                console.error(`[DEBUG] Error caching tile ${z}/${x}/${y}:`, error);
            }
            
            processed++;
            
            // Update progress every 50 tiles or at the end
            if (processed % 50 === 0 || processed === tileCount) {
                const progress = processed / tileCount;
                progressBar.style.width = `${50 + (progress * 50)}%`; // Scale from 50% to 100%
                cacheCount.textContent = processed;
                statusText.textContent = `Extracting tiles... ${Math.floor(progress * 100)}%`;
                
                // Give time for UI update
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        tilesStmt.free();
        db.close();
        
        // Show completion message
        statusText.textContent = 'Tile extraction complete!';
        progressBar.style.width = '100%';
        
        // Refresh the map using the new tiles
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('mbtilesExtracted'));
            
            // Hide progress after a moment
            setTimeout(() => {
                progressElement.style.display = 'none';
                
                // Show confirmation message
                alert(`Successfully processed ${processed} map tiles from ${file.name}. The map is now available offline.`);
            }, 2000);
        }, 1000);
        
        return true;
    } catch (error) {
        console.error('[DEBUG] Error processing MBTiles file:', error);
        statusText.textContent = `Error: ${error.message}`;
        progressBar.style.backgroundColor = '#f44336'; // Red for error
        
        setTimeout(() => {
            progressElement.style.display = 'none';
        }, 5000);
        
        throw error;
    }
} 