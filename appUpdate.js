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
                            // Auto reload without confirmation
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
            progressContainer.style.display = 'none';
            document.body.removeChild(progressContainer);
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
        
        // Step 1: Get latest coreFiles.js module
        progressText.textContent = 'Fetching latest file list...';
        uiElements.progressContainer.style.display = 'block';
        
        try {
            // Fetch the latest coreFiles.js with cache busting
            const coreFilesModule = await fetchCoreFilesModule();
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
            uiElements.progressFill.style.backgroundColor = '#f44336'; // Red for error
            
            setTimeout(() => {
                uiElements.progressContainer.style.display = 'none';
                document.body.removeChild(uiElements.progressContainer);
            }, 5000);
            
            return { success: false, error: error.message };
        }
    } catch (error) {
        console.error('Error updating app:', error);
        alert(`App update failed: ${error.message}`);
        return { success: false, error: error.message };
    }
} 