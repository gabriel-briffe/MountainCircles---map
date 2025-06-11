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
    // MAP_BOUNDS,
    TILE_CACHE_SETTINGS
} from "./config.js";

// Import from cacheConfig
import { cacheConfigurationFiles } from "./cacheConfig.js";

// Import tile caching functionality
import { cacheTiles, cacheAlpsTiles, cachePyreneesTiles, cacheJuraNordVosgesTiles, cacheNorwayTiles } from "./cacheTiles.js";

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
    
    // Cache background map button - now will auto-download the Alps map
    document.getElementById('cacheBackgroundMapBtn').addEventListener('click', () => {
        console.log('[Menu] Starting download and caching of Alps background map');
        cacheAlpsTiles();
    });

    // Cache Pyrenees map button
    document.getElementById('cachePyreneesMapBtn').addEventListener('click', () => {
        console.log('[Menu] Starting download and caching of Pyrenees background map');
        cachePyreneesTiles();
    });

    // Cache Jura Nord Vosges map button
    document.getElementById('cacheJuraNordVosgesMapBtn').addEventListener('click', () => {
        console.log('[Menu] Starting download and caching of Jura Nord Vosges background map');
        cacheJuraNordVosgesTiles();
    });

    // Cache Norway map button
    document.getElementById('cacheNorwayMapBtn').addEventListener('click', () => {
        console.log('[Menu] Starting download and caching of Norway background map');
        cacheNorwayTiles();
    });

    // Cache EDL Today tiles button
    document.getElementById('cacheEDLTodayBtn').addEventListener('click', () => {
        console.log('[Menu] Caching today\'s EDL forecast');
        cacheEDLTiles(false); // false = today
    });
    
    // Cache EDL Tomorrow tiles button
    document.getElementById('cacheEDLTomorrowBtn').addEventListener('click', () => {
        console.log('[Menu] Caching tomorrow\'s EDL forecast');
        cacheEDLTiles(true); // true = tomorrow
    });
    
    // Cache Yesterday's Forecast for Today button
    document.getElementById('cacheEDLYesterdayForTodayBtn').addEventListener('click', () => {
        console.log('[Menu] Caching yesterday\'s forecast for today');
        cacheEDLTiles(false, true); // false = today, true = use yesterday's forecast
    });
    
    // Refresh Airspace Data button removed - now handled by airspace import system
    
    // Clean EDL Cache button
    document.getElementById('cleanEDLCacheBtn').addEventListener('click', () => {
        console.log('[Menu] Cleaning EDL cache');
        if (confirm('Are you sure you want to delete all EDL cached data? This will remove all cached weather forecast tiles.')) {
            window.location.href = `${BASE_PATH}/bootstrap.html?cleanEdl=true`;
        }
    });
    
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
