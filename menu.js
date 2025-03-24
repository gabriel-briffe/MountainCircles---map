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
        
        // Create a promise that resolves when caching is complete
        const cachingComplete = new Promise((resolve, reject) => {
            const messageHandler = (event) => {
                const data = event.data;
                
                switch (data.type) {
                    case 'cacheStart':
                        uiElements.progressBar.style.width = '0%';
                        uiElements.cacheCount.textContent = '0';
                        const statusElement = document.querySelector('#cacheProgress .status-text');
                        if (statusElement) {
                            statusElement.textContent = data.message || 'Starting cache process...';
                        }
                        break;
                        
                    case 'cacheProgress':
                        uiElements.cacheCount.textContent = data.completed;
                        const percent = (data.completed / data.total) * 100;
                        uiElements.progressBar.style.width = `${percent}%`;
                        
                        const progressStatus = document.querySelector('#cacheProgress .status-text');
                        if (progressStatus) {
                            progressStatus.textContent = `Caching: ${data.currentFile || ''}`;
                        }
                        break;
                        
                    case 'cacheError':
                        console.error('Cache error:', data.message);
                        uiElements.progressBar.style.backgroundColor = '#f44336'; // Red for error
                        
                        const errorStatus = document.querySelector('#cacheProgress .status-text');
                        if (errorStatus) {
                            errorStatus.textContent = `Error: ${data.message}`;
                        }
                        
                        setTimeout(() => {
                            uiElements.progressElement.style.display = 'none';
                        }, 5000);
                        navigator.serviceWorker.removeEventListener('message', messageHandler);
                        reject(new Error(data.message));
                        break;
                        
                    case 'cacheComplete':
                        uiElements.progressBar.style.width = '100%';
                        
                        const completeStatus = document.querySelector('#cacheProgress .status-text');
                        if (completeStatus) {
                            completeStatus.textContent = data.message || 'Cache complete!';
                        }
                        
                        setTimeout(() => {
                            uiElements.progressElement.style.display = 'none';
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
                uiElements.progressElement.style.display = 'none';
                reject(new Error('Cache operation timed out after 5 minutes'));
            }, 300000); // 5 minute timeout
        });
        
        // Send message to service worker to cache files
        await sendCacheRequestToServiceWorker(files, configDetails.fullConfig);
        
        // Wait for caching to complete
        await cachingComplete;
        
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
 * Handles importing a user-provided MBTiles file
 * @returns {Promise<Object>} - Result of the MBTiles import operation
 */
export async function cacheTiles() {
    console.log('[DEBUG] Cache Background Map button clicked - prompting for MBTiles file');
    
    // Show progress container for map cache
    const progressElement = document.getElementById('mapCacheProgress');
    const progressBar = document.getElementById('mapProgressBar');
    const cacheCount = document.getElementById('mapCacheCount');
    const totalTiles = document.getElementById('mapTotalTiles');
    const statusText = progressElement.querySelector('.status-text');

    if (statusText) {
        statusText.textContent = 'Select an MBTiles file to import';
    }
    
    // Create file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.mbtiles';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    try {
        // Clear any existing tile cache to avoid redundancy
        if ('caches' in window) {
            const tileCacheNames = await caches.keys();
            const tileCaches = tileCacheNames.filter(name => 
                name.startsWith('mapbox-tiles-') || 
                name.includes('tiles') || 
                name.includes('map')
            );
            
            for (const cacheName of tileCaches) {
                if (cacheName !== 'mbtiles-cache') { // Don't delete our MBTiles cache
                    console.log(`[DEBUG] Clearing regular tile cache: ${cacheName}`);
                    await caches.delete(cacheName);
                }
            }
        }
        
        // Prompt the user to select a file
        const fileSelected = new Promise((resolve) => {
            fileInput.onchange = (event) => {
                if (event.target.files.length > 0) {
                    resolve(event.target.files[0]);
                } else {
                    resolve(null);
                }
                document.body.removeChild(fileInput);
            };
            
            // Cancel button handler
            document.addEventListener('click', function cancelHandler(e) {
                if (e.target !== fileInput && !fileInput.contains(e.target)) {
                    document.removeEventListener('click', cancelHandler);
                    if (document.body.contains(fileInput)) {
                        document.body.removeChild(fileInput);
                        resolve(null);
                    }
                }
            }, { once: true, capture: true });
        });
        
        // Click the file input to open file dialog
        fileInput.click();
        
        // Wait for file selection
        const selectedFile = await fileSelected;
        
        if (!selectedFile) {
            console.log('[DEBUG] No MBTiles file selected');
            progressElement.style.display = 'none';
            return { success: false, canceled: true };
        }
        
        // Display file information
        progressElement.style.display = 'block';
        progressBar.style.width = '0%';
        if (statusText) {
            statusText.textContent = `Processing: ${selectedFile.name} (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)`;
        }
        
        // Import the mbtilesUI module
        const mbtilesUI = await import('./mbtilesUI.js');
        
        // Call the MBTiles file processing function
        if (typeof mbtilesUI.processUploadedMBTilesFile === 'function') {
            console.log('[DEBUG] Calling processUploadedMBTilesFile function');
            await mbtilesUI.processUploadedMBTilesFile(selectedFile, {
                progressElement,
                progressBar,
                cacheCount,
                totalTiles,
                statusText
            });
            
            // Return success after extraction completes
            return { success: true };
        } else {
            throw new Error('MBTiles processing function not found in mbtilesUI.js');
        }
    } catch (error) {
        console.error('[DEBUG] Error during MBTiles processing:', error);
        progressElement.style.display = 'none';
        progressBar.style.width = '0%';
        
        // Show error to user
        alert(`Failed to process MBTiles file: ${error.message}`);
        
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
        
        // Set up progress UI using common classes
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-overlay';
        
        const progressText = document.createElement('div');
        progressText.className = 'progress-text';
        progressText.textContent = 'Starting update...';
        
        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'progress-bar-container';
        
        const progressBarFill = document.createElement('div');
        progressBarFill.className = 'progress-bar-fill';
        
        progressBarContainer.appendChild(progressBarFill);
        progressContainer.appendChild(progressText);
        progressContainer.appendChild(progressBarContainer);
        document.body.appendChild(progressContainer);
        
        // Set up message listener for service worker updates
        const messagePromise = new Promise((resolve, reject) => {
            const messageHandler = (event) => {
                const data = event.data;
                
                switch (data.type) {
                    case 'appUpdateStart':
                        progressText.textContent = data.message;
                        break;
                        
                    case 'appUpdateProgress':
                        progressText.textContent = data.message;
                        const percent = (data.completed / data.total) * 100;
                        progressBarFill.style.width = `${percent}%`;
                        break;
                        
                    case 'appUpdateError':
                        progressText.textContent = data.message;
                        progressBarFill.style.backgroundColor = '#f44336'; // Red for error
                        setTimeout(() => {
                            if (document.body.contains(progressContainer)) {
                                document.body.removeChild(progressContainer);
                            }
                        }, 5000);
                        navigator.serviceWorker.removeEventListener('message', messageHandler);
                        reject(new Error(data.message));
                        break;
                        
                    case 'appUpdateFailed':
                        progressText.textContent = data.message;
                        progressBarFill.style.backgroundColor = '#f44336'; // Red for error
                        setTimeout(() => {
                            if (document.body.contains(progressContainer)) {
                                document.body.removeChild(progressContainer);
                            }
                        }, 5000);
                        navigator.serviceWorker.removeEventListener('message', messageHandler);
                        reject(new Error(data.message));
                        break;
                        
                    case 'appUpdateComplete':
                        progressText.textContent = data.message;
                        progressBarFill.style.width = '100%';
                        setTimeout(() => {
                            if (document.body.contains(progressContainer)) {
                                document.body.removeChild(progressContainer);
                            }
                            
                            // Automatically reload after successful update
                            if (data.needsReload) {
                                window.location.reload();
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
                if (document.body.contains(progressContainer)) {
                    document.body.removeChild(progressContainer);
                }
                reject(new Error('Update timed out. No response from service worker.'));
            }, 60000); // 1 minute timeout
        });
        
        // Step 1: Get latest coreFiles.js module
        progressText.textContent = 'Fetching latest file list...';
        
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
            progressBarFill.style.backgroundColor = '#f44336'; // Red for error
            
            setTimeout(() => {
                if (document.body.contains(progressContainer)) {
                    document.body.removeChild(progressContainer);
                }
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
 * Performs a clean installation by clearing all app data and relaunching
 * @returns {Promise<Object>} - Result of the operation
 */
export async function cleanInstall() {
    console.log('[DEBUG] Clean install requested');
    
    if (!confirm('WARNING: This will clear ALL app data including cached maps, configurations, and settings. The app will restart with default settings. Continue?')) {
        return { success: false, canceled: true };
    }
    
    try {
        // Show a progress overlay using common classes
        const progressOverlay = document.createElement('div');
        progressOverlay.className = 'progress-overlay';
        
        const messageElement = document.createElement('div');
        messageElement.className = 'progress-text';
        messageElement.textContent = 'Cleaning installation...';
        
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-bar-container';
        
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar-fill';
        
        progressContainer.appendChild(progressBar);
        progressOverlay.appendChild(messageElement);
        progressOverlay.appendChild(progressContainer);
        document.body.appendChild(progressOverlay);
        
        // Set initial progress
        progressBar.style.width = '10%';
        
        // 1. Clear all caches
        if ('caches' in window) {
            messageElement.textContent = 'Clearing caches...';
            progressBar.style.width = '20%';
            
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
            console.log('[DEBUG] All caches cleared');
        }
        
        progressBar.style.width = '40%';
        messageElement.textContent = 'Clearing local storage...';
        
        // 2. Clear localStorage
        localStorage.clear();
        console.log('[DEBUG] LocalStorage cleared');
        
        progressBar.style.width = '60%';
        messageElement.textContent = 'Clearing session storage...';
        
        // 3. Clear sessionStorage
        sessionStorage.clear();
        console.log('[DEBUG] SessionStorage cleared');
        
        progressBar.style.width = '80%';
        messageElement.textContent = 'Clearing IndexedDB...';
        
        // 4. Clear IndexedDB (more complex)
        try {
            const databases = await indexedDB.databases();
            for (const db of databases) {
                await new Promise((resolve, reject) => {
                    const request = indexedDB.deleteDatabase(db.name);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }
            console.log('[DEBUG] IndexedDB databases cleared');
        } catch (error) {
            console.warn('[DEBUG] Error clearing IndexedDB:', error);
            // Continue anyway
        }
        
        progressBar.style.width = '100%';
        messageElement.textContent = 'Clean installation complete. Restarting...';
        
        // 5. Wait a moment for the user to see the completion message
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // 6. Reload the page properly based on the server environment
        // For local development server, we need to use index.html or the base path
        const cacheBuster = new Date().getTime();
        
        // Check if we're at root or in a subdirectory
        const path = window.location.pathname;
        let reloadUrl;
        
        if (path === '/' || path.endsWith('/')) {
            // We're at the root or a directory path ending with slash
            // Use index.html to avoid 404 on query params
            reloadUrl = path + 'index.html?clean=' + cacheBuster;
        } else if (path.includes('.html')) {
            // We already have an HTML file in the path
            const urlParts = path.split('?')[0]; // Remove any existing query params
            reloadUrl = urlParts + '?clean=' + cacheBuster;
        } else {
            // No clear path, try current path with param
            reloadUrl = path + '?clean=' + cacheBuster;
        }
        
        console.log(`[DEBUG] Reloading to: ${reloadUrl}`);
        window.location.href = reloadUrl;
        
        return { success: true };
    } catch (error) {
        console.error('[DEBUG] Error during clean install:', error);
        alert(`Clean installation failed: ${error.message}. Please try manual cache clearing in your browser settings.`);
        return { success: false, error: error.message };
    }
}

/**
 * Sets up all menu event listeners
 */
export function setupMenuEventListeners() {
    console.log('[DEBUG-MENU] Setting up menu event listeners');
    
    // Popup menu
    const popupMenu = document.getElementById('popupMenu');
    document.getElementById('moreOptionsBtn').addEventListener('click', () => {
        console.log('[DEBUG-MENU] More options button clicked');
        popupMenu.style.display = "flex";
    });
    
    document.getElementById('closePopupBtn').addEventListener('click', () => {
        console.log('[DEBUG-MENU] Close popup button clicked');
        popupMenu.style.display = "none";
    });
    
    popupMenu.addEventListener('click', (e) => {
        if(e.target === popupMenu) {
            console.log('[DEBUG-MENU] Popup menu background clicked');
            popupMenu.style.display = "none";
        }
    });
    
    // Cache configuration button
    const cacheConfigBtn = document.getElementById('cacheCurrentConfigBtn');
    if (cacheConfigBtn) {
        cacheConfigBtn.addEventListener('click', cacheConfigurationFiles);
    }
    
    // Cache background map button (now used for MBTiles extraction)
    const cacheBackgroundMapBtn = document.getElementById('cacheBackgroundMapBtn');
    if (cacheBackgroundMapBtn) {
        cacheBackgroundMapBtn.addEventListener('click', cacheTiles);
    }
    
    // App update button
    const appUpdateBtn = document.getElementById('appUpdateBtn');
    if (appUpdateBtn) {
        appUpdateBtn.addEventListener('click', updateApp);
    }
    
    // Clean Install button (add after app update button)
    const cleanInstallBtn = document.createElement('button');
    cleanInstallBtn.id = 'cleanInstallBtn';
    cleanInstallBtn.className = 'config-button button-with-icon';
    cleanInstallBtn.innerHTML = `
        <span class="material-icons-round">delete_forever</span>
        <span>Clean Install (Reset All)</span>
    `;
    
    // Insert the clean install button after the app update button
    if (appUpdateBtn && appUpdateBtn.parentNode) {
        appUpdateBtn.parentNode.insertBefore(cleanInstallBtn, appUpdateBtn.nextSibling);
        
        // Add event listener
        cleanInstallBtn.addEventListener('click', cleanInstall);
        
        console.log('[DEBUG-MENU] Clean install button added');
    } else {
        console.warn('[DEBUG-MENU] Could not find app update button to insert clean install button after it');
    }
    
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
