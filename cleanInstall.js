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
 * Creates the clean install button and adds it to the DOM
 * @param {HTMLElement} parentElement - Element to insert the button after (typically app update button)
 * @returns {HTMLElement} The created button
 */
export function createCleanInstallButton(parentElement) {
    const cleanInstallBtn = document.createElement('button');
    cleanInstallBtn.id = 'cleanInstallBtn';
    cleanInstallBtn.className = 'config-button button-with-icon';
    cleanInstallBtn.innerHTML = `
        <span class="material-icons-round">delete_forever</span>
        <span>Clean Install (Reset All)</span>
    `;
    
    // Insert after the parent element
    if (parentElement && parentElement.parentNode) {
        parentElement.parentNode.insertBefore(cleanInstallBtn, parentElement.nextSibling);
        console.log('[DEBUG-MENU] Clean install button added');
    } else {
        console.warn('[DEBUG-MENU] Could not find parent element to insert clean install button after it');
    }
    
    return cleanInstallBtn;
} 