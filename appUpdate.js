/**
 * App Update module for MountainCircles Map
 * Handles app update functionality through service worker
 */

// Get latest core files list
async function fetchCoreFilesModule() {
    const timestamp = new Date().getTime();
    return await import(`./coreFiles.js?v=${timestamp}`);
}

/**
 * Sets up UI elements for update progress
 * @returns {Object} UI elements for progress tracking
 */
function setupUpdateProgressUI() {
    // Create progress overlay using the same style as cleanInstall
    const progressOverlay = document.createElement('div');
    progressOverlay.className = 'progress-overlay';
    
    const messageElement = document.createElement('div');
    messageElement.className = 'progress-text';
    messageElement.textContent = 'Starting update...';
    
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-bar-container';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar-fill';
    
    progressContainer.appendChild(progressBar);
    progressOverlay.appendChild(messageElement);
    progressOverlay.appendChild(progressContainer);
    document.body.appendChild(progressOverlay);
    
    return { progressOverlay, messageElement, progressBar };
}

/**
 * Sets up a message handler for update events from service worker
 * @param {Object} uiElements - The UI elements for progress display
 * @returns {Promise} Promise that resolves when update completes or rejects on error
 */
function setupMessageHandler(uiElements) {
    const { progressOverlay, messageElement, progressBar } = uiElements;
    
    return new Promise((resolve, reject) => {
        const messageHandler = (event) => {
            const data = event.data;
            
            switch (data.type) {
                case 'appUpdateStart':
                    progressOverlay.style.display = 'flex';
                    messageElement.textContent = data.message;
                    break;
                    
                case 'appUpdateProgress':
                    messageElement.textContent = data.message;
                    const percent = (data.completed / data.total) * 100;
                    progressBar.style.width = `${percent}%`;
                    break;
                    
                case 'appUpdateError':
                    messageElement.textContent = data.message;
                    progressBar.style.backgroundColor = '#f44336'; // Red for error
                    setTimeout(() => {
                        if (document.body.contains(progressOverlay)) {
                            document.body.removeChild(progressOverlay);
                        }
                    }, 3000);
                    navigator.serviceWorker.removeEventListener('message', messageHandler);
                    reject(new Error(data.message));
                    break;
                    
                case 'appUpdateFailed':
                    messageElement.textContent = data.message;
                    progressBar.style.backgroundColor = '#f44336'; // Red for error
                    setTimeout(() => {
                        if (document.body.contains(progressOverlay)) {
                            document.body.removeChild(progressOverlay);
                        }
                    }, 3000);
                    navigator.serviceWorker.removeEventListener('message', messageHandler);
                    reject(new Error(data.message));
                    break;
                    
                case 'appUpdateComplete':
                    messageElement.textContent = data.message || 'Update complete. Restarting...';
                    progressBar.style.width = '100%';
                    setTimeout(() => {
                        if (document.body.contains(progressOverlay)) {
                            document.body.removeChild(progressOverlay);
                        }
                        
                        if (data.needsReload) {
                            // Auto reload without confirmation
                            window.location.reload();
                        }
                    }, 1500);
                    navigator.serviceWorker.removeEventListener('message', messageHandler);
                    resolve();
                    break;
            }
        };
        
        navigator.serviceWorker.addEventListener('message', messageHandler);
        
        // Add timeout to remove listener if no response
        setTimeout(() => {
            navigator.serviceWorker.removeEventListener('message', messageHandler);
            messageElement.textContent = 'Update timed out. No response from service worker.';
            progressBar.style.backgroundColor = '#f44336'; // Red for error
            
            setTimeout(() => {
                if (document.body.contains(progressOverlay)) {
                    document.body.removeChild(progressOverlay);
                }
            }, 3000);
            
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
        // Use progress overlay instead of alert
        const progressOverlay = document.createElement('div');
        progressOverlay.className = 'progress-overlay';
        
        const messageElement = document.createElement('div');
        messageElement.className = 'progress-text';
        messageElement.textContent = 'Service workers are not supported in this browser. Cannot update the app.';
        
        progressOverlay.appendChild(messageElement);
        document.body.appendChild(progressOverlay);
        
        setTimeout(() => {
            document.body.removeChild(progressOverlay);
        }, 3000);
        
        return { success: false, error: 'Service workers not supported' };
    }
    
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
            throw new Error('No service worker registration found');
        }
        
        // Set up progress UI
        const uiElements = setupUpdateProgressUI();
        const { messageElement, progressBar } = uiElements;
        
        if (!navigator.serviceWorker.controller) {
            // If service worker is not controlling the page yet, update and reload
            await registration.update();
            messageElement.textContent = 'App update started. Page will reload to complete the update...';
            progressBar.style.width = '100%';
            
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
            return { success: true };
        }
        
        // Set up message listener for service worker updates
        const messagePromise = setupMessageHandler(uiElements);
        
        // Step 1: Get latest coreFiles.js module
        messageElement.textContent = 'Fetching latest file list...';
        progressBar.style.width = '10%';
        
        try {
            // Fetch the latest coreFiles.js with cache busting
            const coreFilesModule = await fetchCoreFilesModule();
            console.log(`[App Update] Successfully imported coreFiles.js module`, coreFilesModule);
            
            // Get the list of files to update
            const filesToUpdate = coreFilesModule.getCoreFiles();
            console.log(`[App Update] Retrieved ${filesToUpdate.length} files to update:`, filesToUpdate);
            
            messageElement.textContent = `Found ${filesToUpdate.length} files to update...`;
            progressBar.style.width = '20%';
            
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
            messageElement.textContent = `Error fetching file list: ${error.message}`;
            progressBar.style.backgroundColor = '#f44336'; // Red for error
            
            setTimeout(() => {
                if (document.body.contains(uiElements.progressOverlay)) {
                    document.body.removeChild(uiElements.progressOverlay);
                }
            }, 3000);
            
            return { success: false, error: error.message };
        }
    } catch (error) {
        console.error('Error updating app:', error);
        
        // Show error with progress overlay instead of alert
        const progressOverlay = document.createElement('div');
        progressOverlay.className = 'progress-overlay';
        
        const messageElement = document.createElement('div');
        messageElement.className = 'progress-text';
        messageElement.textContent = `App update failed: ${error.message}`;
        
        progressOverlay.appendChild(messageElement);
        document.body.appendChild(progressOverlay);
        
        setTimeout(() => {
            document.body.removeChild(progressOverlay);
        }, 3000);
        
        return { success: false, error: error.message };
    }
} 