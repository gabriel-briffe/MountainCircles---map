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
    TILE_CACHE_SETTINGS
} from "./config.js";

// Import from cacheConfig
import { cacheConfigurationFiles } from "./cacheConfig.js";

// Import tile caching functionality
import { cacheTiles } from "./cacheTiles.js";

// Import EDL caching functionality
import { cacheEDLTiles } from "./cacheEdl.js";

/**
 * Sets up all menu event listeners
 */
export function setupMenuEventListeners() {
    // Popup menu
    const modalMenu = document.getElementById('modalMenu');
    document.getElementById('moreOptionsBtn').addEventListener('click', () => {
        // Check if the sidebar is visible and close it
        const sidebar = document.getElementById('airspace-sidebar');
        if (sidebar && sidebar.style.display === 'block') {
            // Use dynamic import to avoid circular dependencies
            import('./sidebar.js').then(module => {
                module.toggleSidebar();
            });
        }

        // Show the popup menu
        modalMenu.style.display = "flex";
    });
    document.getElementById('closePopupBtn').addEventListener('click', () => {
        modalMenu.style.display = "none";
    });
    modalMenu.addEventListener('click', (e) => {
        if(e.target === modalMenu) {
            modalMenu.style.display = "none";
        }
    });
    
    // Cache configuration button
    document.getElementById('cacheCurrentConfigBtn').addEventListener('click', cacheConfigurationFiles);
    
    // Cache background map button
    document.getElementById('cacheBackgroundMapBtn').addEventListener('click', cacheTiles);

    // Cache EDL tiles button
    document.getElementById('cacheEDLTilesBtn').addEventListener('click', cacheEDLTiles);
    
    // App update button
    const appUpdateBtn = document.getElementById('appUpdateBtn');
    appUpdateBtn.addEventListener('click', () => {
        window.location.href = `${BASE_PATH}/bootstrap.html?update=coreFiles`;
    });
    
    // Clean Install button
    document.getElementById('cleanInstallBtn').addEventListener('click', () => {
        if (confirm('WARNING: This will delete ALL app data including cached maps, saved settings, and offline data. The app will start fresh. Continue?')) {
            window.location.href = `${BASE_PATH}/bootstrap.html?update=all`;
        }
    });

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
