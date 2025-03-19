/**
 * coreFiles.js - Core files list for MountainCircles Map
 * 
 * This file is the single source of truth for which files should be updated
 * when the app is updated.
 */

// Import BASE_PATH from config if available, or define it here
let BASE_PATH = '.';
try {
    if (typeof window !== 'undefined') {
        // Try to get BASE_PATH from config in browser context
        import('./config.js').then(config => {
            BASE_PATH = config.BASE_PATH;
        }).catch(() => {
            console.warn('Could not import BASE_PATH from config.js, using default "."');
        });
    }
} catch (e) {
    console.warn('Error accessing window or importing config, using default BASE_PATH "."');
}

/**
 * Returns the list of core app files that should be updated when updating the app
 * @returns {string[]} Array of file paths
 */
export function getCoreFiles() {
    return [
        // HTML files
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
