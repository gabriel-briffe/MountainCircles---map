/**
 * Menu module for MountainCircles Map
 * Contains functions for menu UI elements and interactions
 */

// Import from utils
import { latLngToTile } from "./utils.js";

// Import from state management
import { 
    clearSavedState 
} from "./state.js";

// Import from config
import {
    BASE_PATH,
    MAP_BOUNDS,
    TILE_CACHE_SETTINGS,
    CACHE_TIMEOUT
} from "./config.js";

// Import from appUpdate
import { updateApp } from "./appUpdate.js";

// Import from cacheConfig
import { cacheConfigurationFiles } from "./cacheConfig.js";

// Import clean install functionality
import { cleanInstall, createCleanInstallButton } from "./cleanInstall.js";

/**
 * Caches map tiles for offline use
 * @returns {Promise<Object>} - Result of the tile caching operation
 */
export async function cacheTiles() {
    console.debug('[Menu] Starting tile cache process');
    
    const progressElement = document.getElementById('mapCacheProgress');
    const progressBar = document.getElementById('mapProgressBar');
    const cacheCount = document.getElementById('mapCacheCount');
    const totalTiles = document.getElementById('mapTotalTiles');

    progressElement.style.display = 'block';
    progressBar.style.width = '0%';

    try {
        console.debug('[Menu] Getting map bounds and tile settings');
        console.debug(`[Menu] MAP_BOUNDS: ${JSON.stringify(MAP_BOUNDS)}`);
        console.debug(`[Menu] TILE_CACHE_SETTINGS: ${JSON.stringify(TILE_CACHE_SETTINGS)}`);
        
        const bounds = MAP_BOUNDS;
        const minZoom = TILE_CACHE_SETTINGS.minZoom;
        const maxZoom = TILE_CACHE_SETTINGS.maxZoom;
        
        console.debug(`[Menu] Using zoom levels from ${minZoom} to ${maxZoom}`);

        const tiles = [];
        for (let z = minZoom; z <= maxZoom; z++) {
            console.debug(`[Menu] Calculating tiles for zoom level ${z}`);
            
            const northwest = latLngToTile(bounds[0][1], bounds[0][0], z);
            const southeast = latLngToTile(bounds[1][1], bounds[1][0], z);
            
            console.debug(`[Menu] Northwest tile at zoom ${z}: x=${northwest.x}, y=${northwest.y}`);
            console.debug(`[Menu] Southeast tile at zoom ${z}: x=${southeast.x}, y=${southeast.y}`);

            const minX = Math.min(northwest.x, southeast.x);
            const maxX = Math.max(northwest.x, southeast.x);
            const minY = Math.min(northwest.y, southeast.y);
            const maxY = Math.max(northwest.y, southeast.y);
            
            console.debug(`[Menu] Tile range at zoom ${z}: x=${minX}-${maxX}, y=${minY}-${maxY}`);
            
            const levelTileCount = (maxX - minX + 1) * (maxY - minY + 1);
            console.debug(`[Menu] Total tiles at zoom ${z}: ${levelTileCount}`);

            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    tiles.push({ x, y, z });
                }
            }
        }

        console.debug(`[Menu] Total tiles to cache: ${tiles.length}`);
        totalTiles.textContent = tiles.length;

        let completedTiles = 0;
        let timeoutId;
        
        // Create a promise that resolves when all tiles are cached
        console.debug('[Menu] Setting up tile caching promise');
        const cachingComplete = new Promise((resolve, reject) => {
            const messageHandler = (event) => {
                if (event.data.type === 'cacheTileComplete') {
                    completedTiles++;
                    cacheCount.textContent = completedTiles;
                    const percentage = (completedTiles / tiles.length) * 100;
                    progressBar.style.width = `${percentage}%`;

                    if (completedTiles % 50 === 0) {
                        console.debug(`[Menu] Cached ${completedTiles}/${tiles.length} tiles (${percentage.toFixed(1)}%)`);
                    }

                    if (completedTiles === tiles.length) {
                        console.debug('[Menu] All tiles cached successfully');
                        navigator.serviceWorker.removeEventListener('message', messageHandler);
                        resolve();
                    }
                } else if (event.data.type === 'cacheTileError') {
                    console.error(`[Menu] Error caching tile: ${event.data.error}`, event.data.tileInfo);
                    // Continue caching other tiles, but log the error
                }
            };

            console.debug('[Menu] Adding service worker message listener');
            navigator.serviceWorker.addEventListener('message', messageHandler);
            
            // Set a timeout to reject the promise if it takes too long
            console.debug(`[Menu] Setting timeout for ${CACHE_TIMEOUT}ms`);
            timeoutId = setTimeout(() => {
                console.error(`[Menu] Tile caching timed out after ${CACHE_TIMEOUT}ms`);
                navigator.serviceWorker.removeEventListener('message', messageHandler);
                reject(new Error('Tile caching timed out after 5 minutes'));
            }, CACHE_TIMEOUT); // Use timeout from config
        });

        console.debug('[Menu] Getting service worker registration');
        const registration = await navigator.serviceWorker.ready;
        if (!registration || !registration.active) {
            console.error('[Menu] Service worker not ready or active');
            throw new Error('Service worker not ready or active');
        }
        
        console.debug(`[Menu] Sending cacheTiles message to service worker with ${tiles.length} tiles`);
        console.debug(`[Menu] Tile base path: ${TILE_CACHE_SETTINGS.basePath}`);
        
        registration.active.postMessage({
            type: 'cacheTiles',
            tiles: tiles,
            basePath: TILE_CACHE_SETTINGS.basePath
        });

        // Wait for caching to complete
        console.debug('[Menu] Waiting for caching to complete');
        await cachingComplete;
        
        // Clear the timeout if it exists
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        
        console.debug('[Menu] Tile caching completed successfully');
        progressElement.style.display = 'none';
        progressBar.style.width = '0%';
        
        return { success: true, tileCount: tiles.length };
    } catch (error) {
        console.error('[Menu] Error caching tiles:', error);
        progressElement.style.display = 'none';
        progressBar.style.width = '0%';
        
        // Show error to user
        alert(`Failed to cache tiles: ${error.message}`);
        
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
    const appUpdateBtn = document.getElementById('appUpdateBtn');
    appUpdateBtn.addEventListener('click', updateApp);
    
    // Create and add clean install button after app update button
    const cleanInstallBtn = createCleanInstallButton(appUpdateBtn);
    cleanInstallBtn.addEventListener('click', cleanInstall);

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
