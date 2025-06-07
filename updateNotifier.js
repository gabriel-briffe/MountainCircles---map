/**
 * Update Notifier module for MountainCircles Map
 * Coordinates with Web Worker to check for updates and display notifications
 */

import { createNotification } from './notification.js';
import { BASE_PATH } from './config.js';

// Constants
const AIRSPACE_ETAG_KEY = 'airspace_etag';
const APP_CORE_ETAG_KEY = 'app_core_etag';

// Web Worker instance
let updateWorker = null;

/**
 * Initialize the update notifier
 */
export function initUpdateNotifier() {
    if (typeof Worker === 'undefined') {
        console.warn('[UpdateNotifier] Web Workers are not supported in this browser');
        return false;
    }
    
    try {
        // Create the Web Worker
        updateWorker = new Worker(`${BASE_PATH}/updateChecker.js`);
        
        // Set up message handlers
        updateWorker.onmessage = handleWorkerMessage;
        updateWorker.onerror = (error) => {
            console.error('[UpdateNotifier] Worker error:', error);
        };
        
        // Check if we already have ETags in localStorage
        const storedAirspaceETag = localStorage.getItem(AIRSPACE_ETAG_KEY);
        const storedCoreFilesETag = localStorage.getItem(APP_CORE_ETAG_KEY);
        
        // Initialize the worker with stored ETags from localStorage
        updateWorker.postMessage({
            type: 'init',
            data: {
                airspaceETag: storedAirspaceETag,
                coreFilesETag: storedCoreFilesETag
            }
        });
        
        console.log('[UpdateNotifier] Update checker worker initialized with ETags:', 
            { airspaceETag: storedAirspaceETag, coreFilesETag: storedCoreFilesETag });
        
        return true;
    } catch (error) {
        console.error('[UpdateNotifier] Failed to initialize update worker:', error);
        return false;
    }
}

/**
 * Handle messages from the Web Worker
 * @param {MessageEvent} event - Message event from worker
 */
function handleWorkerMessage(event) {
    const { type, result, progress } = event.data;
    
    switch (type) {
        case 'airspaceUpdateResult':
            handleAirspaceUpdateResult(result);
            break;
        case 'coreFilesUpdateResult':
            handleCoreFilesUpdateResult(result);
            break;
        case 'coreFilesCheckProgress':
            // Handle progress updates if needed
            console.log(`[UpdateNotifier] Core files check progress: ${progress.completed}/${progress.total}`);
            break;
        default:
            console.warn('[UpdateNotifier] Unknown message type from worker:', type);
    }
}

/**
 * Handle airspace update check results
 * @param {Object} result - Result from the airspace update check
 */
function handleAirspaceUpdateResult(result) {
    console.log('[UpdateNotifier] Received airspace update result:', result);
    
    if (result.error) {
        console.error('[UpdateNotifier] Airspace update check error:', result.error);
        return;
    }
    
    if (result.hasUpdate) {
        // Show notification for available update
        showAirspaceUpdateNotification();
    } else if (result.noETag) {
        console.log('[UpdateNotifier] No stored airspace ETag, skipping notification');
    } else if (!result.noVersionInfo) {
        // Don't show up-to-date notification
        console.log('[UpdateNotifier] Airspace data is up to date');
    }
}

/**
 * Handle core files update check results
 * @param {Object} result - Result from the core files update check
 */
function handleCoreFilesUpdateResult(result) {
    console.log('[UpdateNotifier] Received core files update result:', result);
    
    if (result.error) {
        console.error('[UpdateNotifier] Core files update check error:', result.error);
        return;
    }
    
    if (result.hasUpdate) {
        // Show notification for available update
        showAppUpdateNotification();
    } else if (result.filesChecked > 0) {
        // Don't show up-to-date notification
        console.log('[UpdateNotifier] App is up to date');
    }
}

/**
 * Check for all updates (airspace and core files)
 */
export function checkForUpdates() {
    if (!updateWorker) {
        console.warn('[UpdateNotifier] Worker not initialized, cannot check for updates');
        return false;
    }
    
    // Extract files list
    const files = extractCoreFilesList();
    
    // Check if we have core ETags already stored
    const coreETag = localStorage.getItem(APP_CORE_ETAG_KEY);
    
    if (coreETag) {
        // We have ETags, run the check immediately
        console.log('[UpdateNotifier] Found core ETags, running update check immediately');
        return performUpdateCheck(files, BASE_PATH);
    } else {
        // No ETags yet, set up a one-time listener for the etagsReceived event
        console.log('[UpdateNotifier] No core ETags found, waiting for ETags...');
        
        // Set up a one-time listener
        window.addEventListener('etagsReceived', () => {
            console.log('[UpdateNotifier] ETags received, running update check now');
            
            // Re-read the ETag from localStorage
            const updatedCoreETag = localStorage.getItem(APP_CORE_ETAG_KEY);
            
            // Update the worker with the new ETag
            updateWorker.postMessage({
                type: 'init',
                data: {
                    airspaceETag: localStorage.getItem(AIRSPACE_ETAG_KEY),
                    coreFilesETag: updatedCoreETag
                }
            });
            
            // Perform the check
            performUpdateCheck(files, BASE_PATH);
        }, { once: true });
        
        return true;
    }
}

/**
 * Actually perform the update check
 * @param {Array} files - Files to check
 * @param {string} basePath - Base path
 * @returns {boolean} Success
 */
function performUpdateCheck(files, basePath) {
    // Send message to worker to check both types of updates
    updateWorker.postMessage({
        type: 'checkAllUpdates',
        data: {
            files: files,
            basePath: basePath
        }
    });
    
    return true;
}

/**
 * Extract list of core files to check for updates
 * @returns {Array} List of core files
 */
function extractCoreFilesList() {
    // This should match INITIAL_CACHE_RESOURCES in sw.js
    // Excluding external resources
    return [
        // HTML files
        // Note: index.html is served at root '/' by Cloudflare Pages, not as '/index.html'
        'manifest.json',
        
        // CSS files
        'styles.css',
        'airspacePopup.css',
        'installPrompt.css',
        'mapDock.css',
        'menu.css',
        'navbox.css',
        'parameters.css',
        'progressBar.css',
        'secondaryDock.css',
        'sidebar.css',
        
        // JS files
        'airspace.js',
        'airspaceStyle.js',
        'cacheConfig.js',
        'cacheEdl.js',
        'cacheTiles.js',
        'circlesUI.js',
        'config.js',
        'dock.js',
        'edl.js',
        'edlUI.js',
        'igc.js',
        'init.js',
        'install.js',
        'LayerManager.js',
        'layers.js',
        'layerStyles.js',
        'location.js',
        'main.js',
        'map.js',
        'mapInitializer.js',
        'mappings.js',
        'mbtiles.js',
        'menu.js',
        'navboxManager.js',
        'notification.js',
        'sidebar.js',
        'state.js',
        'sw.js',
        'toggleManager.js',
        'tracking.js',
        'utils.js',
        'updateChecker.js',
        'updateNotifier.js'
    ];
}

/**
 * Shows a notification to the user about new airspace data
 */
function showAirspaceUpdateNotification() {
    createNotification(
        'New airspace data available', 
        'new_releases'
    );
}

/**
 * Shows a notification to the user about app updates
 */
function showAppUpdateNotification() {
    createNotification(
        'App updates available', 
        'system_update'
    );
}

// Clean up when the module is unloaded
window.addEventListener('unload', () => {
    if (updateWorker) {
        updateWorker.terminate();
        updateWorker = null;
    }
}); 