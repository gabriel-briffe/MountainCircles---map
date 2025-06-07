/**
 * Update Notifier module for MountainCircles Map
 * Coordinates with Web Worker to check for updates and display notifications
 */

import { createNotification } from './notification.js';
import { BASE_PATH } from './config.js';

// Constants
const AIRSPACE_ETAG_KEY = 'airspace_etag';
const CACHED_VERSION_KEY = 'cached_version';

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
        
        // Check if we already have version and ETag in localStorage
        const storedAirspaceETag = localStorage.getItem(AIRSPACE_ETAG_KEY);
        const cachedVersion = parseInt(localStorage.getItem(CACHED_VERSION_KEY)) || 0;
        
        // Initialize the worker with stored values from localStorage
        updateWorker.postMessage({
            type: 'init',
            data: {
                airspaceETag: storedAirspaceETag,
                version: cachedVersion
            }
        });
        
        console.log('[UpdateNotifier] Update checker worker initialized with version:', cachedVersion);
        
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
 * Handle version update check results
 * @param {Object} result - Result from the version update check
 */
function handleCoreFilesUpdateResult(result) {
    console.log('[UpdateNotifier] Received version update result:', result);
    
    if (result.error) {
        console.error('[UpdateNotifier] Version update check error:', result.error);
        return;
    }
    
    if (result.hasUpdate) {
        console.log(`[UpdateNotifier] App update available: cached version ${result.cachedVersion}, server version ${result.serverVersion}`);
        // Show notification for available update
        showAppUpdateNotification();
    } else {
        console.log(`[UpdateNotifier] App is up to date: version ${result.cachedVersion}`);
    }
}

/**
 * Check for all updates (airspace and version)
 */
export function checkForUpdates() {
    if (!updateWorker) {
        console.warn('[UpdateNotifier] Worker not initialized, cannot check for updates');
        return false;
    }
    
    // Check if we have a cached version
    const cachedVersion = parseInt(localStorage.getItem(CACHED_VERSION_KEY)) || 0;
    
    if (cachedVersion > 0) {
        // We have a version, run the check immediately
        console.log('[UpdateNotifier] Found cached version, running update check immediately');
        return performUpdateCheck(BASE_PATH);
    } else {
        // No version yet, set up a one-time listener for the versionReceived event
        console.log('[UpdateNotifier] No cached version found, waiting for version...');
        
        // Set up a one-time listener
        window.addEventListener('versionReceived', () => {
            console.log('[UpdateNotifier] Version received, running update check now');
            
            // Re-read the version from localStorage
            const updatedVersion = parseInt(localStorage.getItem(CACHED_VERSION_KEY)) || 0;
            
            // Update the worker with the new version
            updateWorker.postMessage({
                type: 'init',
                data: {
                    airspaceETag: localStorage.getItem(AIRSPACE_ETAG_KEY),
                    version: updatedVersion
                }
            });
            
            // Perform the check
            performUpdateCheck(BASE_PATH);
        }, { once: true });
        
        return true;
    }
}

/**
 * Actually perform the update check
 * @param {string} basePath - Base path
 * @returns {boolean} Success
 */
function performUpdateCheck(basePath) {
    // Send message to worker to check both types of updates
    updateWorker.postMessage({
        type: 'checkAllUpdates',
        data: {
            basePath: basePath
        }
    });
    
    return true;
}

/**
 * Receive cached version from service worker
 * @param {Object} data - Version data from service worker
 */
export function receiveCachedVersion(data) {
    const version = data.version;
    
    // Store the version in localStorage
    localStorage.setItem(CACHED_VERSION_KEY, version.toString());
    
    console.log(`[DEBUG] Version: Storing new version in localStorage. New=${version}`);
    
    // Dispatch event to notify that version has been received
    window.dispatchEvent(new CustomEvent('versionReceived'));
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