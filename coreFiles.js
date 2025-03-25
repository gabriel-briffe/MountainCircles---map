/**
 * coreFiles.js - Core files list for MountainCircles Map
 * 
 * This file is the single source of truth for which files should be updated
 * when the app is updated.
 */

// Import the BASE_PATH from config
import { BASE_PATH } from './config.js';

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
        `${BASE_PATH}/airspace.js`,
        `${BASE_PATH}/airspaceStyle.js`,
        `${BASE_PATH}/appUpdate.js`,
        `${BASE_PATH}/cacheConfig.js`,
        `${BASE_PATH}/cacheEdl.js`,
        `${BASE_PATH}/cacheTiles.js`,
        `${BASE_PATH}/cleanInstall.js`,
        `${BASE_PATH}/config.js`,
        `${BASE_PATH}/coreFiles.js`,
        `${BASE_PATH}/dock.js`,
        `${BASE_PATH}/edl.js`,
        `${BASE_PATH}/igc.js`,
        `${BASE_PATH}/init.js`,
        `${BASE_PATH}/install.js`,
        `${BASE_PATH}/LayerManager.js`,
        `${BASE_PATH}/layers.js`,
        `${BASE_PATH}/layerStyles.js`,
        `${BASE_PATH}/location.js`,
        `${BASE_PATH}/main.js`,
        `${BASE_PATH}/map.js`,
        `${BASE_PATH}/mapInitializer.js`,
        `${BASE_PATH}/mappings.js`,
        `${BASE_PATH}/mbtiles.js`,
        `${BASE_PATH}/menu.js`,
        `${BASE_PATH}/navboxManager.js`,
        `${BASE_PATH}/sidebar.js`,
        `${BASE_PATH}/state.js`,
        `${BASE_PATH}/sw.js`,
        `${BASE_PATH}/toggleManager.js`,
        `${BASE_PATH}/tracking.js`,
        `${BASE_PATH}/utils.js`,
        
        // GeoJSON files
        `${BASE_PATH}/peaks.geojson`,
        `${BASE_PATH}/passes.geojson`,
        `${BASE_PATH}/airspace.geojson`,
        
        // Icons
        `${BASE_PATH}/icons/icon-192.png`,
    ];
}
