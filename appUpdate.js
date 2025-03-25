/**
 * App Update module for MountainCircles Map
 * Handles app update functionality through service worker
 */

// Import from the config
import { BASE_PATH } from './config.js';
import { getCoreFiles } from './coreFiles.js';

/**
 * Sets up the UI elements for app update progress
 * @returns {Object} The UI elements
 */
function setupUpdateProgressUI() {
    // Use the existing progress elements in the popup menu
    const progressContainer = document.getElementById('appUpdateProgress');
    const progressText = progressContainer.querySelector('.progress-status');
    const progressBar = progressContainer.querySelector('.progress-bar-container');
    const progressFill = document.getElementById('appUpdateProgressBar');
    
    // Reset to initial state
    progressText.textContent = 'Starting update...';
    progressFill.style.width = '0%';
    progressFill.classList.remove('progress-bar-error');
    progressContainer.style.display = 'flex';
    
    return { progressContainer, progressText, progressBar, progressFill };
}

/**
 * Sets up a message handler for update events from service worker
 * @param {Object} uiElements - The UI elements for progress display
 * @returns {Promise} Promise that resolves when update completes or rejects on error
 */
function setupMessageHandler(uiElements) {
    const { progressContainer, progressText, progressFill } = uiElements;
    
    return new Promise((resolve, reject) => {
        const messageHandler = (event) => {
            const data = event.data;
            
            switch (data.type) {
                case 'appUpdateStart':
                    progressContainer.style.display = 'flex';
                    progressText.textContent = data.message;
                    break;
                    
                case 'appUpdateProgress':
                    progressText.textContent = data.message;
                    const percent = (data.completed / data.total) * 100;
                    progressFill.style.width = `${percent}%`;
                    break;
                    
                case 'appUpdateError':
                    progressText.textContent = data.message;
                    progressFill.classList.add('progress-bar-error');
                    setTimeout(() => {
                        progressContainer.style.display = 'none';
                        progressFill.style.width = '0%';
                        progressFill.classList.remove('progress-bar-error');
                        progressText.textContent = 'Updating app...';
                    }, 5000);
                    navigator.serviceWorker.removeEventListener('message', messageHandler);
                    reject(new Error(data.message));
                    break;
                    
                case 'appUpdateFailed':
                    progressText.textContent = data.message;
                    progressFill.classList.add('progress-bar-error');
                    setTimeout(() => {
                        progressContainer.style.display = 'none';
                        progressFill.style.width = '0%';
                        progressFill.classList.remove('progress-bar-error');
                        progressText.textContent = 'Updating app...';
                    }, 5000);
                    navigator.serviceWorker.removeEventListener('message', messageHandler);
                    reject(new Error(data.message));
                    break;
                    
                case 'appUpdateComplete':
                    progressText.textContent = data.message;
                    progressFill.style.width = '100%';
                    setTimeout(() => {
                        progressContainer.style.display = 'none';
                        progressFill.style.width = '0%';
                        
                        if (data.needsReload) {
                            // Check if HTML files were updated
                            const htmlFilesUpdated = data.updatedFiles && 
                                data.updatedFiles.some(file => file.endsWith('.html'));
                            
                            if (htmlFilesUpdated) {
                                // If HTML was updated, use a cache-busting reload approach
                                const cacheBuster = Date.now();
                                
                                // Use BASE_PATH to ensure we respect the deployment location
                                // Determine the index file path taking BASE_PATH into account
                                let indexPath;
                                
                                if (window.location.pathname === BASE_PATH || 
                                    window.location.pathname === BASE_PATH + '/' || 
                                    window.location.pathname === '/') {
                                    // We're at the root - use the BASE_PATH + index.html
                                    indexPath = BASE_PATH + '/index.html';
                                } else {
                                    // We're at some other path - preserve it
                                    indexPath = window.location.pathname;
                                }
                                
                                // Remove any double slashes
                                indexPath = indexPath.replace(/\/\//g, '/');
                                
                                // Build URL with cache-busting parameter
                                // First, create a URL object to properly handle parameters
                                const url = new URL(window.location.href);
                                
                                // Remove any existing 'update' parameters
                                url.searchParams.delete('update');
                                
                                // Set the new path and add a fresh update parameter
                                url.pathname = indexPath;
                                url.searchParams.set('update', cacheBuster.toString());
                                
                                // Navigate to the clean URL
                                window.location.href = url.toString();
                            } else {
                                // For JS-only updates, a simple reload is sufficient
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
            progressFill.style.width = '0%';
            progressText.textContent = 'Updating app...';
            reject(new Error('Update timed out. No response from service worker.'));
        }, 60000); // 1 minute timeout
    });
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
        const uiElements = setupUpdateProgressUI();
        const { progressText } = uiElements;
        
        // Set up message listener for service worker updates
        const messagePromise = setupMessageHandler(uiElements);
        
        // Step 1: Get the core files list (now directly imported)
        progressText.textContent = 'Getting file list...';
        uiElements.progressContainer.style.display = 'flex';
        uiElements.progressFill.style.width = '10%';
        
        try {
            // Get the list of files to update directly from the imported function
            const filesToUpdate = getCoreFiles();
            console.log(`[App Update] Retrieved ${filesToUpdate.length} files to update:`, filesToUpdate);
            
            progressText.textContent = `Found ${filesToUpdate.length} files to update...`;
            uiElements.progressFill.style.width = '20%';
            
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
            progressText.textContent = `Error updating files: ${error.message}`;
            uiElements.progressFill.classList.add('progress-bar-error');
            
            setTimeout(() => {
                uiElements.progressContainer.style.display = 'none';
                uiElements.progressFill.style.width = '0%';
                uiElements.progressFill.classList.remove('progress-bar-error');
                progressText.textContent = 'Updating app...';
            }, 5000);
            
            return { success: false, error: error.message };
        }
    } catch (error) {
        console.error('Error updating app:', error);
        alert(`App update failed: ${error.message}`);
        return { success: false, error: error.message };
    }
} 