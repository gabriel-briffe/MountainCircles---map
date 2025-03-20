/**
 * Menu module for MountainCircles Map
 * Contains functions for menu UI elements and interactions
 */

// Import from utils
import { latLngToTile } from "./utils.js";

// Import from state management
import { 
    getCurrentConfig, 
    clearSavedState 
} from "./state.js";

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
 * Updates the app by triggering a service worker update for core files
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
        
        if (!navigator.serviceWorker.controller) {
            // If service worker is not controlling the page yet, update and reload
            await registration.update();
            alert('App update started. Please reload the page to complete the update.');
            return { success: true };
        }
        
        // Set up progress UI
        const progressContainer = document.createElement('div');
        progressContainer.id = 'update-progress-container';
        progressContainer.style.position = 'fixed';
        progressContainer.style.top = '50%';
        progressContainer.style.left = '50%';
        progressContainer.style.transform = 'translate(-50%, -50%)';
        progressContainer.style.backgroundColor = 'white';
        progressContainer.style.padding = '20px';
        progressContainer.style.borderRadius = '8px';
        progressContainer.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        progressContainer.style.zIndex = '10000';
        progressContainer.style.display = 'none';
        
        const progressText = document.createElement('div');
        progressText.id = 'update-progress-text';
        progressText.style.marginBottom = '10px';
        progressText.textContent = 'Starting update...';
        
        const progressBar = document.createElement('div');
        progressBar.id = 'update-progress-bar';
        progressBar.style.height = '20px';
        progressBar.style.backgroundColor = '#f0f0f0';
        progressBar.style.borderRadius = '4px';
        progressBar.style.overflow = 'hidden';
        
        const progressFill = document.createElement('div');
        progressFill.id = 'update-progress-fill';
        progressFill.style.height = '100%';
        progressFill.style.backgroundColor = '#4CAF50';
        progressFill.style.width = '0%';
        progressFill.style.transition = 'width 0.3s';
        
        progressBar.appendChild(progressFill);
        progressContainer.appendChild(progressText);
        progressContainer.appendChild(progressBar);
        document.body.appendChild(progressContainer);
        
        // Set up message listener for service worker updates
        const messagePromise = new Promise((resolve, reject) => {
            const messageHandler = (event) => {
                const data = event.data;
                
                switch (data.type) {
                    case 'appUpdateStart':
                        progressContainer.style.display = 'block';
                        progressText.textContent = data.message;
                        break;
                        
                    case 'appUpdateProgress':
                        progressText.textContent = data.message;
                        const percent = (data.completed / data.total) * 100;
                        progressFill.style.width = `${percent}%`;
                        break;
                        
                    case 'appUpdateError':
                        progressText.textContent = data.message;
                        progressFill.style.backgroundColor = '#f44336'; // Red for error
                        setTimeout(() => {
                            if (document.body.contains(progressContainer)) {
                                progressContainer.style.display = 'none';
                                document.body.removeChild(progressContainer);
                            }
                        }, 5000);
                        navigator.serviceWorker.removeEventListener('message', messageHandler);
                        reject(new Error(data.message));
                        break;
                        
                    case 'appUpdateFailed':
                        progressText.textContent = data.message;
                        progressFill.style.backgroundColor = '#f44336'; // Red for error
                        setTimeout(() => {
                            if (document.body.contains(progressContainer)) {
                                progressContainer.style.display = 'none';
                                document.body.removeChild(progressContainer);
                            }
                        }, 5000);
                        navigator.serviceWorker.removeEventListener('message', messageHandler);
                        reject(new Error(data.message));
                        break;
                        
                    case 'appUpdateComplete':
                        progressText.textContent = data.message;
                        progressFill.style.width = '100%';
                        setTimeout(() => {
                            if (document.body.contains(progressContainer)) {
                                progressContainer.style.display = 'none';
                                document.body.removeChild(progressContainer);
                            }
                            
                            if (data.needsReload) {
                                if (confirm('Update complete! Reload page to apply changes?')) {
                                    window.location.reload();
                                }
                            }
                        }, 2000);
                        navigator.serviceWorker.removeEventListener('message', messageHandler);
                        resolve();
                        break;
                }
            };
            
            navigator.serviceWorker.addEventListener('message', messageHandler);
            
            // Add timeout to remove listener if no response
            setTimeout(() => {
                navigator.serviceWorker.removeEventListener('message', messageHandler);
                progressContainer.style.display = 'none';
                document.body.removeChild(progressContainer);
                reject(new Error('Update timed out. No response from service worker.'));
            }, 60000); // 1 minute timeout
        });
        
        // Step 1: Get latest coreFiles.js module
        progressText.textContent = 'Fetching latest file list...';
        progressContainer.style.display = 'block';
        
        try {
            // Fetch the latest coreFiles.js with cache busting
            const timestamp = new Date().getTime();
            const coreFilesModule = await import(`./coreFiles.js?v=${timestamp}`);
            console.log(`[App Update] Successfully imported coreFiles.js module`, coreFilesModule);
            
            // Get the list of files to update
            const filesToUpdate = coreFilesModule.getCoreFiles();
            console.log(`[App Update] Retrieved ${filesToUpdate.length} files to update:`, filesToUpdate);
            
            progressText.textContent = `Found ${filesToUpdate.length} files to update...`;
            
            // Step 2: Send the list of files to update to the service worker
            navigator.serviceWorker.controller.postMessage({
                type: 'updateAppFiles',
                files: filesToUpdate
            });
            
            // Wait for the update to complete
            console.log(`[App Update] Waiting for service worker to complete update`);
            await messagePromise;
            console.log(`[App Update] Update process completed successfully`);
            return { success: true };
        } catch (error) {
            console.error('[App Update] Error during update process:', error);
            progressText.textContent = `Error fetching file list: ${error.message}`;
            progressFill.style.backgroundColor = '#f44336'; // Red for error
            
            setTimeout(() => {
                progressContainer.style.display = 'none';
                document.body.removeChild(progressContainer);
            }, 5000);
            
            return { success: false, error: error.message };
        }
    } catch (error) {
        console.error('Error updating app:', error);
        alert(`App update failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Sets up all menu event listeners
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

    // Add a hidden emergency reset function
    // This can be triggered by clicking a specific sequence or from the console
    window.resetMountainCirclesState = async function() {
        if (confirm('WARNING: This will reset all your saved settings to defaults. This is meant for emergency situations where the app might be displaying incorrect data. Continue?')) {
            try {
                const success = await clearSavedState();
                if (success) {
                    alert('Settings have been reset to defaults. The page will now reload.');
                    window.location.reload();
                } else {
                    alert('Failed to reset settings. Please try clearing your browser cache manually.');
                }
            } catch (error) {
                console.error('Error during reset:', error);
                alert('An error occurred while trying to reset settings: ' + error.message);
            }
        }
    };

    // You can add a UI element for this if needed, or keep it as a console-only function
    // For safety-critical applications, having an emergency reset is important
    console.log('Emergency reset function available via window.resetMountainCirclesState()');
}
