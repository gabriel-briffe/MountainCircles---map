/**
 * Cache Configuration module for MountainCircles Map
 * Handles caching of configuration files for offline use
 */

// Import from state management
import { getCurrentConfig } from "./state.js";
import { BASE_PATH, DATA_BASE_PATH } from "./config.js";

// Import from sidebar
import { updateSidebarConfigButtonStyles } from "./sidebar.js";

/**
 * Sets up the UI elements for cache progress
 * @returns {Object} - UI elements for progress tracking
 */
export function setupCacheProgressUI() {
    const progressElement = document.getElementById('cacheProgress');
    const progressBar = document.getElementById('progressBar');
    const cacheCount = document.getElementById('cacheCount');
    const totalFiles = document.getElementById('totalFiles');
    
    progressElement.style.display = 'flex';
    
    return { progressElement, progressBar, cacheCount, totalFiles };
}

/**
 * Extracts configuration details from current config
 * @returns {Object} Object with policy, config, configPrefix, and fullConfig
 */
export function getConfigDetails() {
    console.debug('[CacheConfig] Getting config details');
    const fullConfig = getCurrentConfig();
    console.debug(`[CacheConfig] Current config: ${fullConfig}`);
    
    const configParts = fullConfig.split('/');
    const policy = configParts[0];
    const config = configParts.length > 1 ? configParts[1] : '';
    const configPrefix = config.split('-').slice(0, 3).join('-');
    
    console.debug(`[CacheConfig] Parsed config - policy: ${policy}, config: ${config}, prefix: ${configPrefix}`);
    
    return { policy, config, configPrefix, fullConfig };
}

/**
 * Builds list of files to cache based on configuration
 * @param {Object} configDetails - Configuration details from getConfigDetails()
 * @returns {Promise<Array>} Array of file paths to cache
 */
export async function prepareFilesToCache(configDetails) {
    try {
        console.debug('[CacheConfig] Preparing files to cache, config details:', configDetails);
        
        const { policy, configPrefix, fullConfig } = configDetails;
        const mainGeojsonUrl = `${DATA_BASE_PATH}/${fullConfig}/aa_${policy}_${configPrefix}.geojson`;
        
        console.debug(`[CacheConfig] Main GeoJSON URL: ${mainGeojsonUrl}`);
        
        // Fetch main GeoJSON
        console.debug(`[CacheConfig] Fetching main GeoJSON file`);
        const response = await fetch(mainGeojsonUrl);
        
        if (!response.ok) {
            console.error(`[CacheConfig] Failed to fetch main GeoJSON: ${response.status} ${response.statusText}, URL: ${mainGeojsonUrl}`);
            throw new Error(`Failed to fetch main GeoJSON: ${response.status} ${response.statusText}`);
        }
        
        console.debug(`[CacheConfig] Main GeoJSON fetched successfully`);
        const data = await response.json();
        console.debug(`[CacheConfig] GeoJSON parsed, features count: ${data.features ? data.features.length : 'unknown'}`);
        
        // Filter point features with filenames
        const pointFeatures = data.features.filter(f => 
            f.geometry.type === 'Point' && f.properties.filename);
        
        console.debug(`[CacheConfig] Found ${pointFeatures.length} point features with filenames`);
        
        // Log the first few filenames for debugging
        if (pointFeatures.length > 0) {
            const sampleFeatures = pointFeatures.slice(0, Math.min(3, pointFeatures.length));
            sampleFeatures.forEach((f, i) => {
                console.debug(`[CacheConfig] Sample point feature ${i+1}: ${f.properties.filename}`);
            });
        }
        
        // Create list of files to cache with absolute paths
        const filesToCache = [
            // Policy-level file for quick airfield display
            `${DATA_BASE_PATH}/${policy}/${policy}.geojson`,
            // Configuration-specific files
            `${DATA_BASE_PATH}/${fullConfig}/aa_${policy}_${configPrefix}.geojson`,
            `${DATA_BASE_PATH}/${fullConfig}/aa_${policy}_${configPrefix}_sectors1.geojson`,
            ...pointFeatures.map(f => `${DATA_BASE_PATH}/${fullConfig}/${f.properties.filename}`)
        ];
        
        console.debug(`[CacheConfig] Total files to cache: ${filesToCache.length} (including policy file: ${policy}.geojson)`);
        console.debug(`[CacheConfig] First few files to cache:`, filesToCache.slice(0, Math.min(5, filesToCache.length)));
        
        return filesToCache;
    } catch (error) {
        console.error('[CacheConfig] Error preparing files to cache:', error);
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
    console.debug(`[CacheConfig] Sending cache request to service worker for ${files.length} files with config: ${config}`);
    
    try {
        const registration = await navigator.serviceWorker.ready;
        if (!registration || !registration.active) {
            console.error('[CacheConfig] Service worker not ready or active');
            throw new Error('Service worker not ready or active');
        }
        
        console.debug('[CacheConfig] Service worker is ready, sending message');
        registration.active.postMessage({
            type: 'cacheFiles',
            files: files,
            config: config
        });
        
        console.debug('[CacheConfig] Cache request sent to service worker');
    } catch (error) {
        console.error('[CacheConfig] Error sending cache request to service worker:', error);
        throw error;
    }
}

/**
 * Handles errors during caching
 * @param {Error} error - The error that occurred
 * @param {Object} uiElements - UI elements for progress tracking
 */
export function handleCacheError(error, uiElements) {
    console.error('[CacheConfig] Error caching configuration:', error);
    uiElements.progressElement.style.display = 'none';
    uiElements.progressBar.style.width = '0%';
    
    // Show error to user
    alert(`Failed to cache configuration: ${error.message}`);
}

/**
 * Caches configuration files for offline use
 * @returns {Promise<Object>} - Result of the caching operation
 */
export async function cacheConfigurationFiles() {
    console.debug('[CacheConfig] Starting configuration files caching process');
    
    // Setup UI elements
    const uiElements = setupCacheProgressUI();
    
    try {
        // Get configuration details
        console.debug('[CacheConfig] Getting configuration details');
        const configDetails = getConfigDetails();
        
        // Fetch main GeoJSON and prepare file list
        console.debug('[CacheConfig] Preparing files to cache');
        const files = await prepareFilesToCache(configDetails);
        
        // Update total files count in UI
        uiElements.totalFiles.textContent = files.length;
        console.debug(`[CacheConfig] Updated UI with total files: ${files.length}`);
        
        // Send message to service worker to cache files
        console.debug('[CacheConfig] Sending cache request to service worker');
        await sendCacheRequestToServiceWorker(files, configDetails.fullConfig);
        
        // Create a promise that resolves when the service worker sends a 'cacheComplete' message
        console.debug('[CacheConfig] Waiting for cache completion message from service worker');
        await waitForCacheComplete();
        
        // After caching is complete, update cache indicators for sidebar config buttons
        console.debug('[CacheConfig] Cache completion confirmed, updating sidebar config button styles');
        await updateSidebarConfigButtonStyles();
        
        console.debug('[CacheConfig] Configuration caching process completed successfully');
        return { success: true, fileCount: files.length };
    } catch (error) {
        console.error('[CacheConfig] Error in cacheConfigurationFiles:', error);
        handleCacheError(error, uiElements);
        return { success: false, error: error.message };
    }
}

/**
 * Creates a promise that resolves when the service worker sends a 'cacheComplete' message
 * @returns {Promise<void>} Promise that resolves on cache completion
 */
function waitForCacheComplete() {
    return new Promise((resolve) => {
        const messageHandler = (event) => {
            if (event.data && event.data.type === 'cacheComplete') {
                console.debug('[CacheConfig] Received cacheComplete message from service worker');
                navigator.serviceWorker.removeEventListener('message', messageHandler);
                resolve();
            }
        };
        
        navigator.serviceWorker.addEventListener('message', messageHandler);
        
        // Add a timeout in case the service worker never responds
        setTimeout(() => {
            console.warn('[CacheConfig] Cache completion message timeout - continuing anyway');
            navigator.serviceWorker.removeEventListener('message', messageHandler);
            resolve();
        }, 30000); // 30 second timeout
    });
} 