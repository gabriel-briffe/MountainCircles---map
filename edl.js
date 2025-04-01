/**
 * EDL Weather Layer Module for MountainCircles Map
 * Handles the creation and management of EDL weather forecast layers
 */

import { BASE_PATH } from './config.js';
import { getLayerManager } from './state.js';
import { getEDLMetadata, hasEDLTiles } from './cacheEdl.js';
import { navigateToCurrentTime } from './edlUI.js';

// Constants for EDL layer
const DEFAULT_PRESSURE = 500; // Changed from 50000 (500 hPa)
const DEFAULT_OPACITY = 0.7;
const PRESSURE_LEVELS = [500, 600, 700, 800, 900]; // Changed from Pa to hPa
console.log('[MODIFIED] edl.js - Updated pressure constants to use hPa instead of Pa');

// Global reference to the current EDL layer
let currentEDLLayer = null;
let currentLayerInfo = null;

/**
 * Creates an EDL layer for the map
 * @param {Object} map - The Leaflet map instance
 * @param {Object} options - Layer options
 * @returns {Object} The created layer
 */
export function createEDLLayer(map, options = {}) {
    console.log('[EDL] Creating EDL layer');
    
    // Check if EDL tiles are available
    if (!hasEDLTiles()) {
        console.warn('[EDL] No EDL tiles available, cannot create layer');
        return null;
    }
    
    // Get available dates, hours, and pressures from metadata
    const metadata = getEDLMetadata();
    
    // Default options
    const layerOptions = {
        opacity: DEFAULT_OPACITY,
        pressure: DEFAULT_PRESSURE,
        ...options
    };
    
    // Get the most recent available date from metadata
    const availableDates = Object.keys(metadata.availableLayers).sort();
    const dateString = availableDates[availableDates.length - 1] || new Date().toISOString().slice(0, 10);
    
    // Get available hours for this date
    const availableHours = Object.keys(metadata.availableLayers[dateString] || {}).map(h => parseInt(h));
    if (availableHours.length === 0) {
        console.warn(`[EDL] No hours available for date ${dateString}`);
        return null;
    }
    
    // Find the nearest available hour to current time
    const today = new Date();
    
    // Make sure we're working with UTC hours
    const hour = today.getUTCHours(); 
    console.log(`[MODIFIED] edl.js - Using UTC hours: ${hour} (local hour: ${today.getHours()})`);
    console.log(`[MODIFIED] edl.js - Date being used: ${dateString}`);
    
    const nearestHour = findNearestValue(hour, availableHours);
    
    // Check if the selected pressure is available for this date/hour
    const availablePressures = metadata.availableLayers[dateString][nearestHour] || [];
    
    // Use the first available pressure if the default isn't available
    const pressure = availablePressures.includes(layerOptions.pressure) 
        ? layerOptions.pressure 
        : (availablePressures[0] || DEFAULT_PRESSURE);
    
    // For debugging, log available options
    console.log(`[EDL] Available dates: ${availableDates.join(', ')}`);
    console.log(`[EDL] Available hours: ${availableHours.join(', ')}`);
    // Updated log to show pressures in hPa directly (no division needed)
    console.log(`[EDL] Available pressure levels: ${availablePressures.join(', ')} hPa`);
    console.log('[MODIFIED] edl.js - Now showing pressure levels directly in hPa without conversion');
    
    // Initial layer info
    currentLayerInfo = {
        date: dateString,
        hour: nearestHour,
        pressure: pressure
    };
    
    // Create the tile layer path based on cached tiles
    const tilePath = BASE_PATH 
        ? `${BASE_PATH}/edl_tiles/${dateString}_${nearestHour}_${pressure}/{z}/{x}/{y}.png`
        : `/edl_tiles/${dateString}_${nearestHour}_${pressure}/{z}/{x}/{y}.png`;
    console.log(`[EDL] Tile path: ${tilePath}`);
    
    try {
        // Add source for EDL layer
        getLayerManager().addOrUpdateSource('edl-source', {
            type: 'raster',
            tiles: [tilePath],
            tileSize: 256,
            minzoom: 6,
            maxzoom: 8
        });
        
        console.log(`[EDL] Added EDL source with tilePath: ${tilePath}`);
        
        // Define layer style
        const edlLayerStyle = {
            id: 'edl-layer',
            type: 'raster',
            source: 'edl-source',
            minzoom: 0,  // Layer is visible at all zoom levels
            maxzoom: 22, // Layer is visible at all zoom levels
            paint: {
                'raster-opacity': layerOptions.opacity
            }
        };
        
        // Add layer to map
        getLayerManager().addLayerIfNotExists('edl-layer', edlLayerStyle);
        console.log(`[EDL] EDL layer added to map`);
        
        // Store current layer info
        currentLayerInfo = {
            date: dateString,
            hour: nearestHour,
            pressure: pressure
        };
        
        // Create layer result object
        const layerResult = {
            id: 'edl-layer',
            info: currentLayerInfo
        };
        
        
        // Return the layer
        return layerResult;
    } catch (error) {
        console.error(`[EDL] Error creating EDL layer: ${error.message}`);
        return null;
    }
}

/**
 * Updates the EDL layer with new parameters
 * @param {string} date - Date string in YYYY-MM-DD format 
 * @param {number} hour - Hour (7-21)
 * @param {number} pressure - Pressure level in Pa
 * @returns {boolean} Success status
 */
export function updateEDLLayer(date, hour, pressure) {
    console.log(`[EDL] Updating EDL layer - date: ${date}, hour: ${hour}, pressure: ${pressure}`);
    
    // Check if EDL tiles are available
    if (!hasEDLTiles()) {
        console.warn('[EDL] No EDL tiles available, cannot update layer');
        return false;
    }
    
    // Verify that the requested parameters exist in metadata
    const metadata = getEDLMetadata();
    const dateExists = metadata.availableLayers[date];
    const hourExists = dateExists && metadata.availableLayers[date][hour];
    const pressureExists = hourExists && metadata.availableLayers[date][hour].includes(pressure);
    
    if (!dateExists || !hourExists || !pressureExists) {
        console.warn(`[EDL] Requested parameters not available - date: ${date}, hour: ${hour}, pressure: ${pressure}`);
        return false;
    }
    
    try {
        // Create new tile URL with proper BASE_PATH
        const tilePath = BASE_PATH 
            ? `${BASE_PATH}/edl_tiles/${date}_${hour}_${pressure}/{z}/{x}/{y}.png`
            : `/edl_tiles/${date}_${hour}_${pressure}/{z}/{x}/{y}.png`;
        
        console.log(`[EDL] Using tile path: ${tilePath}`);
        
        const layerManager = getLayerManager();
        
        // Add/update the source with new tile URL and zoom level constraints
        // The minzoom/maxzoom parameters will make MapLibre automatically use the
        // closest available zoom level for zoom levels outside the specified range
        layerManager.addOrUpdateSource('edl-source', {
            type: 'raster',
            tiles: [tilePath],
            tileSize: 256,
            minzoom: 6,
            maxzoom: 8
        });
        
        console.log(`[EDL] Updated EDL source with tilePath: ${tilePath}`);
        
        // Re-add the layer if needed
        const edlLayerStyle = {
            id: 'edl-layer',
            type: 'raster',
            source: 'edl-source',
            minzoom: 0,  // Layer is visible at all zoom levels
            maxzoom: 22, // Layer is visible at all zoom levels
            paint: {
                'raster-opacity': DEFAULT_OPACITY
            }
        };
        
        layerManager.addLayerIfNotExists('edl-layer', edlLayerStyle);
        
        // Update current layer info
        currentLayerInfo = {
            date, 
            hour,
            pressure
        };
        
        // Ensure proper layer order
        layerManager.redrawLayersInOrder();
        console.log(`[EDL] Called redrawLayersInOrder to ensure proper layer stacking`);
        
        return true;
    } catch (error) {
        console.error(`[EDL] Error updating EDL layer: ${error.message}`);
        return false;
    }
}

/**
 * Sets the opacity of the EDL layer
 * @param {number} opacity - Opacity value (0-1)
 */
export function setEDLLayerOpacity(opacity) {
    console.log(`[EDL] Setting EDL layer opacity to ${opacity}`);
    try {
        getLayerManager().setPaintProperty('edl-layer', 'raster-opacity', opacity);
    } catch (error) {
        console.error(`[EDL] Error setting opacity: ${error.message}`);
    }
}

/**
 * Gets available pressure levels from metadata or fallback to defaults
 * @param {string} date - Date string in YYYY-MM-DD format
 * @param {number} hour - Hour 
 * @returns {Array} Available pressure levels in hPa
 */
export function getAvailablePressureLevels(date, hour) {
    // Check metadata first
    const metadata = getEDLMetadata();
    if (metadata && metadata.availableLayers && metadata.availableLayers[date] && 
        metadata.availableLayers[date][hour]) {
        return metadata.availableLayers[date][hour];
    }
    
    // Fall back to default pressure levels (now in hPa)
    return PRESSURE_LEVELS;
}

/**
 * Gets available hours from metadata or fallback to defaults
 * @param {string} date - Date string in YYYY-MM-DD format
 * @returns {Array} Available hours
 */
export function getAvailableHours(date) {
    // Check metadata first
    const metadata = getEDLMetadata();
    if (metadata && metadata.availableLayers && metadata.availableLayers[date]) {
        return Object.keys(metadata.availableLayers[date]).map(h => parseInt(h));
    }
    
    // Fall back to default hours
    return [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
}

/**
 * Gets available dates from metadata
 * @returns {Array} Available dates
 */
export function getAvailableDates() {
    // Check metadata
    const metadata = getEDLMetadata();
    if (metadata && metadata.availableLayers) {
        return Object.keys(metadata.availableLayers).sort();
    }
    
    // Fall back to today's date in UTC
    const today = new Date();
    const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const utcDateString = utcToday.toISOString().slice(0, 10);
    console.log(`[MODIFIED] edl.js - Fallback to UTC date: ${utcDateString} (local date: ${new Date().toLocaleDateString()})`);
    return [utcDateString];
}

/**
 * Finds the nearest value in an array
 * @param {number} value - Target value
 * @param {Array} array - Array of values to search
 * @returns {number} Nearest value
 */
function findNearestValue(value, array) {
    if (!array || array.length === 0) return value;
    return array.reduce((prev, curr) => {
        return (Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
    });
}

/**
 * Toggles visibility of the EDL layer
 * @param {boolean} isVisible - Whether the EDL layer should be visible
 */
export function toggleEDLVisibility(isVisible) {
    console.log(`[EDL] Toggling EDL layer visibility: ${isVisible}`);
    
    // Update layer visibility
    const layerManager = getLayerManager();
    if (layerManager && layerManager.hasLayer('edl-layer')) {
        console.log(`[EDL] Setting EDL layer visibility to ${isVisible ? 'visible' : 'none'}`);
        layerManager.setVisibility('edl-layer', isVisible);
        
        // Redraw layers to ensure proper order
        layerManager.redrawLayersInOrder();
    } else {
        console.log(`[EDL] Layer does not exist, cannot change visibility`);
    }
}

/**
 * Checks the contents of the EDL tile cache and logs information about available tiles
 * This is a debugging function to help diagnose 404 issues
 */
async function checkEDLCacheContents() {
    try {
        // Only check if we need to check the specific directory for the current layer
        if (!currentLayerInfo) {
            return;
        }
        
        // First, check if caches API is available
        if (!('caches' in window)) {
            console.warn('[EDL] Cache API not available in this browser');
            return;
        }
        
        // Try to open the tile cache
        const cache = await caches.open('mountaincircles-tiles-v1');
        
        // Build the specific path we're trying to load
        const expectedDir = `edl_tiles/${currentLayerInfo.date}_${currentLayerInfo.hour}_${currentLayerInfo.pressure}`;
        console.log(`[EDL] Checking cache for: ${expectedDir}`);
        
        // Get matching requests only for the specific directory
        const requests = await cache.keys();
        const matchingRequests = requests.filter(req => 
            req.url.includes(expectedDir)
        );
        
        if (matchingRequests.length === 0) {
            console.warn(`[EDL] No tiles found for ${expectedDir}`);
        } else {
            console.log(`[EDL] Found ${matchingRequests.length} tiles for ${expectedDir}`);
        }
    } catch (error) {
        console.error(`[EDL] Error checking cache: ${error.message}`);
    }
}

/**
 * Gets the current map instance
 * @returns {Object|null} Map instance or null if not available
 */
function getMap() {
    // Check if map is available via window global
    if (window.map) {
        return window.map;
    }
    
    // If not directly accessible, try to get it from the LayerManager
    if (getLayerManager()) {
        return getLayerManager().map;
    }
    
    return null;
}