/**
 * coreFiles.js - Core files list for MountainCircles Map
 * 
 * This file is the single source of truth for which files should be updated
 * when the app is updated.
 */

// Internal implementation of getBasePath as fallback
function internalGetBasePath() {
    // Check if we're on GitHub Pages
    if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;
        const pathname = window.location.pathname;

        if (hostname === 'gabriel-briffe.github.io') {
            console.log('CoreFiles - Detected GitHub Pages deployment');
            return '/MountainCircles---map';
        }
        
        if (pathname.includes('/MountainCircles---map/')) {
            console.log('CoreFiles - Detected repository path in URL');
            return '/MountainCircles---map';
        }
    }
    
    // Default for local development
    console.log('CoreFiles - Using local development path');
    return '.';
}

// Get BASE_PATH
let BASE_PATH;

// Try to get the BASE_PATH from the global context if it exists
// (it would be set if config.js was loaded before this file)
if (typeof window !== 'undefined' && window.mountainCirclesBasePathForCache) {
    console.log('CoreFiles - Using BASE_PATH from global context:', window.mountainCirclesBasePathForCache);
    BASE_PATH = window.mountainCirclesBasePathForCache;
} else {
    // Fall back to internal implementation
    console.log('CoreFiles - BASE_PATH not found in global context, using internal function');
    BASE_PATH = internalGetBasePath();
}

console.log('CoreFiles - Final BASE_PATH:', BASE_PATH);

/**
 * Returns the list of core app files that should be updated when updating the app
 * @returns {string[]} Array of file paths
 */
export function getCoreFiles() {
    console.log('CoreFiles - Generating file list with BASE_PATH:', BASE_PATH);
    
    return [
        // HTML files
        // Root path is removed as it causes 404 errors
        `${BASE_PATH}/index.html`,
        `${BASE_PATH}/manifest.json`,
        
        // CSS files
        `${BASE_PATH}/styles.css`,
        
        // JS files
        `${BASE_PATH}/config.js`,
        `${BASE_PATH}/map.js`,
        `${BASE_PATH}/mapInitializer.js`,
        `${BASE_PATH}/sidebar.js`,
        `${BASE_PATH}/layers.js`,
        `${BASE_PATH}/airspace.js`,
        `${BASE_PATH}/LayerManager.js`,
        `${BASE_PATH}/state.js`,
        `${BASE_PATH}/menu.js`,
        `${BASE_PATH}/utils.js`,
        `${BASE_PATH}/mappings.js`,
        `${BASE_PATH}/init.js`,
        `${BASE_PATH}/dock.js`,
        `${BASE_PATH}/igc.js`,
        `${BASE_PATH}/install.js`,
        `${BASE_PATH}/layerStyles.js`,
        `${BASE_PATH}/navboxManager.js`,
        `${BASE_PATH}/location.js`,
        `${BASE_PATH}/coreFiles.js`, // Include this file itself
        `${BASE_PATH}/sw.js`,
        
        // GeoJSON files
        `${BASE_PATH}/peaks.geojson`,
        `${BASE_PATH}/passes.geojson`,
        `${BASE_PATH}/airspace.geojson`,
        
        // Icons
        `${BASE_PATH}/icons/icon-192.png`,
    ];
}
