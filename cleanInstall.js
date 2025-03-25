/**
 * Clean Install functionality for MountainCircles Map
 * This module provides functions to perform a complete reset of the app
 * by clearing all cached data, localStorage, sessionStorage, and IndexedDB.
 */

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
        // Show progress using the element in the popup menu
        const progressContainer = document.getElementById('cleanInstallProgress');
        const progressText = progressContainer.querySelector('.progress-status');
        const progressBar = document.getElementById('cleanInstallProgressBar');
        
        // Reset initial state
        progressText.textContent = 'Starting clean installation...';
        progressBar.style.width = '0%';
        progressContainer.style.display = 'flex';
        
        // Set initial progress
        progressBar.style.width = '10%';
        
        // 1. Clear all caches
        if ('caches' in window) {
            progressText.textContent = 'Clearing caches...';
            progressBar.style.width = '20%';
            
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
            console.log('[DEBUG] All caches cleared');
        }
        
        progressBar.style.width = '40%';
        progressText.textContent = 'Clearing local storage...';
        
        // 2. Clear localStorage
        localStorage.clear();
        console.log('[DEBUG] LocalStorage cleared');
        
        progressBar.style.width = '60%';
        progressText.textContent = 'Clearing session storage...';
        
        // 3. Clear sessionStorage
        sessionStorage.clear();
        console.log('[DEBUG] SessionStorage cleared');
        
        progressBar.style.width = '80%';
        progressText.textContent = 'Clearing IndexedDB...';
        
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
        progressText.textContent = 'Clean installation complete. Restarting...';
        
        // 5. Wait a moment for the user to see the completion message
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Hide the progress container
        progressContainer.style.display = 'none';
        
        // 6. Reload the page without cache parameters
        // Check if we're at root or in a subdirectory
        const path = window.location.pathname;
        
        if (path === '/' || path.endsWith('/')) {
            // We're at the root or a directory path ending with slash
            window.location.href = path + 'index.html';
        } else if (path.includes('.html')) {
            // We already have an HTML file in the path
            window.location.href = path;
        } else {
            // No clear path, try current path
            window.location.href = path;
        }
        
        return { success: true };
    } catch (error) {
        console.error('[DEBUG] Error during clean install:', error);
        
        // Show error in progress bar if it exists
        try {
            const progressContainer = document.getElementById('cleanInstallProgress');
            const progressText = progressContainer.querySelector('.progress-status');
            const progressBar = document.getElementById('cleanInstallProgressBar');
            
            progressText.textContent = `Error: ${error.message}`;
            progressBar.classList.add('progress-bar-error');
            
            // Hide after delay
            setTimeout(() => {
                progressContainer.style.display = 'none';
                progressBar.classList.remove('progress-bar-error');
                progressBar.style.width = '0%';
                progressText.textContent = 'Resetting application...';
            }, 5000);
        } catch (uiError) {
            console.warn('[DEBUG] Error updating UI:', uiError);
        }
        
        alert(`Clean installation failed: ${error.message}. Please try manual cache clearing in your browser settings.`);
        return { success: false, error: error.message };
    }
} 