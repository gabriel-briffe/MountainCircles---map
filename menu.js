/**
 * Menu module for MountainCircles Map
 * Contains functions for menu UI elements and interactions
 */

// Import from utils
import { latLngToTile } from "./utils.js";

// Import from state management
import { getCurrentConfig } from "./state.js";

// Import from config
import {
    BASE_PATH,
    MAP_BOUNDS,
    TILE_CACHE_SETTINGS,
    CACHE_TIMEOUT
} from "./config.js";

// Import from sidebar
import {
    updateSidebarConfigButtonStyles
} from "./sidebar.js";

/**
 * Caches configuration files for offline use
 * @returns {Promise<Object>} - Result of the caching operation
 */
export async function cacheConfigurationFiles() {
    // Setup UI elements
    const uiElements = setupCacheProgressUI();
    
    try {
        // Get configuration details
        const configDetails = getConfigDetails();
        
        // Fetch main GeoJSON and prepare file list
        const files = await prepareFilesToCache(configDetails);
        
        // Update total files count in UI
        uiElements.totalFiles.textContent = files.length;
        
        // Send message to service worker to cache files
        await sendCacheRequestToServiceWorker(files, configDetails.fullConfig);
        
        // Update cache indicators for sidebar config buttons
        await updateSidebarConfigButtonStyles();
        
        return { success: true, fileCount: files.length };
    } catch (error) {
        handleCacheError(error, uiElements);
        return { success: false, error: error.message };
    }
}

/**
 * Sets up the UI elements for cache progress
 * @returns {Object} - UI elements for progress tracking
 */
export function setupCacheProgressUI() {
    const progressElement = document.getElementById('cacheProgress');
    const progressBar = document.getElementById('progressBar');
    const cacheCount = document.getElementById('cacheCount');
    const totalFiles = document.getElementById('totalFiles');
    
    progressElement.style.display = 'block';
    
    return { progressElement, progressBar, cacheCount, totalFiles };
}

/**
 * Extracts configuration details from current config
 * @returns {Object} Object with policy, config, configPrefix, and fullConfig
 */
export function getConfigDetails() {
    const fullConfig = getCurrentConfig();
    const configParts = fullConfig.split('/');
    const policy = configParts[0];
    const config = configParts.length > 1 ? configParts[1] : '';
    const configPrefix = config.split('-').slice(0, 3).join('-');
    
    return { policy, config, configPrefix, fullConfig };
}

/**
 * Builds list of files to cache based on configuration
 * @param {Object} configDetails - Configuration details from getConfigDetails()
 * @returns {Promise<Array>} Array of file paths to cache
 */
export async function prepareFilesToCache(configDetails) {
    try {
        const { policy, configPrefix, fullConfig } = configDetails;
        const mainGeojsonUrl = `./${fullConfig}/aa_${policy}_${configPrefix}.geojson`;
        
        // Fetch main GeoJSON
        const response = await fetch(mainGeojsonUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch main GeoJSON: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Filter point features with filenames
        const pointFeatures = data.features.filter(f => 
            f.geometry.type === 'Point' && f.properties.filename);
        
        // Create list of files to cache
        return [
            `${fullConfig}/aa_${policy}_${configPrefix}.geojson`,
            `${fullConfig}/aa_${policy}_${configPrefix}_sectors1.geojson`,
            ...pointFeatures.map(f => `${fullConfig}/${f.properties.filename}`)
        ];
    } catch (error) {
        console.error('Error preparing files to cache:', error);
        throw error;
    }
}

/**
 * Sends a cache request to the service worker
 * @param {Array} files - List of files to cache
 * @param {string} config - Configuration string
 * @returns {Promise<void>}
 */
export async function sendCacheRequestToServiceWorker(files, config) {
    const registration = await navigator.serviceWorker.ready;
    if (!registration || !registration.active) {
        throw new Error('Service worker not ready or active');
    }
    
    registration.active.postMessage({
        type: 'cacheFiles',
        files: files,
        config: config
    });
}

/**
 * Handles errors during caching
 * @param {Error} error - The error that occurred
 * @param {Object} uiElements - UI elements for progress tracking
 */
export function handleCacheError(error, uiElements) {
    console.error('Error caching configuration:', error);
    uiElements.progressElement.style.display = 'none';
    uiElements.progressBar.style.width = '0%';
    
    // Show error to user
    alert(`Failed to cache configuration: ${error.message}`);
}

/**
 * Caches map tiles for offline use
 * @returns {Promise<Object>} - Result of the tile caching operation
 */
export async function cacheTiles() {
    const progressElement = document.getElementById('mapCacheProgress');
    const progressBar = document.getElementById('mapProgressBar');
    const cacheCount = document.getElementById('mapCacheCount');
    const totalTiles = document.getElementById('mapTotalTiles');

    progressElement.style.display = 'block';
    progressBar.style.width = '0%';

    try {
        const bounds = MAP_BOUNDS;
        const minZoom = TILE_CACHE_SETTINGS.minZoom;
        const maxZoom = TILE_CACHE_SETTINGS.maxZoom;

        const tiles = [];
        for (let z = minZoom; z <= maxZoom; z++) {
            const northwest = latLngToTile(bounds[0][1], bounds[0][0], z);
            const southeast = latLngToTile(bounds[1][1], bounds[1][0], z);

            const minX = Math.min(northwest.x, southeast.x);
            const maxX = Math.max(northwest.x, southeast.x);
            const minY = Math.min(northwest.y, southeast.y);
            const maxY = Math.max(northwest.y, southeast.y);

            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    tiles.push({ x, y, z });
                }
            }
        }

        totalTiles.textContent = tiles.length;

        let completedTiles = 0;
        let timeoutId;
        
        // Create a promise that resolves when all tiles are cached
        const cachingComplete = new Promise((resolve, reject) => {
            const messageHandler = (event) => {
                if (event.data.type === 'cacheTileComplete') {
                    completedTiles++;
                    cacheCount.textContent = completedTiles;
                    const percentage = (completedTiles / tiles.length) * 100;
                    progressBar.style.width = `${percentage}%`;

                    if (completedTiles === tiles.length) {
                        navigator.serviceWorker.removeEventListener('message', messageHandler);
                        resolve();
                    }
                } else if (event.data.type === 'cacheTileError') {
                    console.error('Error caching tile:', event.data.error);
                    // Continue caching other tiles, but log the error
                }
            };

            navigator.serviceWorker.addEventListener('message', messageHandler);
            
            // Set a timeout to reject the promise if it takes too long
            timeoutId = setTimeout(() => {
                navigator.serviceWorker.removeEventListener('message', messageHandler);
                reject(new Error('Tile caching timed out after 5 minutes'));
            }, CACHE_TIMEOUT); // Use timeout from config
        });

        const registration = await navigator.serviceWorker.ready;
        if (!registration || !registration.active) {
            throw new Error('Service worker not ready or active');
        }
        
        registration.active.postMessage({
            type: 'cacheTiles',
            tiles: tiles,
            basePath: TILE_CACHE_SETTINGS.basePath
        });

        // Wait for caching to complete
        await cachingComplete;
        
        // Clear the timeout if it exists
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        
        progressElement.style.display = 'none';
        progressBar.style.width = '0%';
        
        return { success: true, tileCount: tiles.length };
    } catch (error) {
        console.error('Error caching tiles:', error);
        progressElement.style.display = 'none';
        progressBar.style.width = '0%';
        
        // Show error to user
        alert(`Failed to cache tiles: ${error.message}`);
        
        return { success: false, error: error.message };
    }
}

/**
 * Updates the app by refreshing service worker and cache
 * @returns {Promise<Object>} - Result of the update operation
 */
export async function updateApp() {
    if (!('serviceWorker' in navigator)) {
        alert('Service workers are not supported in this browser. Cannot update the app.');
        return { success: false, error: 'Service workers not supported' };
    }
    
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
            throw new Error('No service worker registration found');
        }
        
        await registration.update();
        
        // List of core files to refresh
        const filesToRefresh = [
            // Core HTML
            `${BASE_PATH}/index.html`,
            // Service worker
            `${BASE_PATH}/sw.js`,
            // CSS files
            `${BASE_PATH}/styles.css`,
            // JS files
            `${BASE_PATH}/main.js`,
            `${BASE_PATH}/init.js`,
            `${BASE_PATH}/mapInitializer.js`,
            `${BASE_PATH}/map.js`,
            `${BASE_PATH}/sidebar.js`,
            `${BASE_PATH}/menu.js`,
            `${BASE_PATH}/dock.js`,
            `${BASE_PATH}/layers.js`,
            `${BASE_PATH}/airspace.js`,
            `${BASE_PATH}/config.js`,
            `${BASE_PATH}/state.js`,
            `${BASE_PATH}/utils.js`,
            `${BASE_PATH}/igc.js`,
            `${BASE_PATH}/install.js`,
            `${BASE_PATH}/airspaceStyle.js`,
            `${BASE_PATH}/mappings.js`,
            `${BASE_PATH}/layerStyles.js`
        ];
        
        // Fetch all files with cache busting
        await Promise.all(
            filesToRefresh.map(file => 
                fetch(file, { cache: 'reload' })
                    .catch(err => console.warn(`Failed to refresh ${file}:`, err))
            )
        );
        
        alert('App update completed. Please reload the page to see the newest version.');
        return { success: true };
    } catch (error) {
        console.error('Error updating app:', error);
        alert(`App update failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Sets up event listeners for menu functionality
 */
export function setupMenuEventListeners() {
    // Popup menu
    const popupMenu = document.getElementById('popupMenu');
    document.getElementById('moreOptionsBtn').addEventListener('click', () => {
        popupMenu.style.display = "flex";
    });
    document.getElementById('closePopupBtn').addEventListener('click', () => {
        popupMenu.style.display = "none";
    });
    popupMenu.addEventListener('click', (e) => {
        if(e.target === popupMenu) {
            popupMenu.style.display = "none";
        }
    });
    
    // Cache configuration button
    document.getElementById('cacheCurrentConfigBtn').addEventListener('click', cacheConfigurationFiles);
    
    // Cache background map button
    document.getElementById('cacheBackgroundMapBtn').addEventListener('click', cacheTiles);
    
    // App update button
    document.getElementById('appUpdateBtn').addEventListener('click', updateApp);
}
