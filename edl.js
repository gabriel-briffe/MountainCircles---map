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
    
    // Get the forecast date from metadata or options
    const forecastDate = options.forecastDate || metadata.lastUsedForecastDate || getLatestForecastDate(metadata);
    
    // Make sure the forecast date exists in the metadata
    if (!forecastDate || !metadata.availableLayers[forecastDate]) {
        console.warn('[EDL] No valid forecast date available');
        return null;
    }
    
    // Get the most recent available target date for this forecast
    const availableTargetDates = Object.keys(metadata.availableLayers[forecastDate]).sort();
    const targetDate = availableTargetDates[availableTargetDates.length - 1] || new Date().toISOString().slice(0, 10);
    
    // Get available hours for this target date
    const availableHours = Object.keys(metadata.availableLayers[forecastDate][targetDate] || {}).map(h => parseInt(h));
    if (availableHours.length === 0) {
        console.warn(`[EDL] No hours available for date ${targetDate} in forecast ${forecastDate}`);
        return null;
    }
    
    // Find the nearest available hour to current time
    const today = new Date();
    
    // Make sure we're working with UTC hours
    const hour = today.getUTCHours(); 
    console.log(`[MODIFIED] edl.js - Using UTC hours: ${hour} (local hour: ${today.getHours()})`);
    console.log(`[MODIFIED] edl.js - Target date: ${targetDate}, Forecast date: ${forecastDate}`);
    
    const nearestHour = findNearestValue(hour, availableHours);
    
    // Check if the selected pressure is available for this date/hour
    const availablePressures = metadata.availableLayers[forecastDate][targetDate][nearestHour] || [];
    
    // Use the first available pressure if the default isn't available
    const pressure = availablePressures.includes(layerOptions.pressure) 
        ? layerOptions.pressure 
        : (availablePressures[0] || DEFAULT_PRESSURE);
    
    // For debugging, log available options
    console.log(`[EDL] Using forecast date: ${forecastDate}`);
    console.log(`[EDL] Available target dates for this forecast: ${availableTargetDates.join(', ')}`);
    console.log(`[EDL] Available hours: ${availableHours.join(', ')}`);
    console.log(`[EDL] Available pressure levels: ${availablePressures.join(', ')} hPa`);
    
    // Initial layer info
    currentLayerInfo = {
        forecastDate: forecastDate,
        date: targetDate,
        hour: nearestHour,
        pressure: pressure
    };
    
    // Use the new EDL protocol instead of file paths
    const tileProtocolUrl = `edl://tiles/${forecastDate}/{z}/{x}/{y}`;
    console.log(`[EDL] Using EDL protocol URL: ${tileProtocolUrl}`);
    
    try {
        // Add source for EDL layer using custom protocol
        getLayerManager().addOrUpdateSource('edl-source', {
            type: 'raster',
            tiles: [tileProtocolUrl],
            tileSize: 256,
            minzoom: 6,
            maxzoom: 8
        });
        
        console.log(`[EDL] Added EDL source with protocol URL: ${tileProtocolUrl}`);
        
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
        
        // Create layer result object
        const layerResult = {
            id: 'edl-layer',
            info: currentLayerInfo
        };
        
        // Make current layer info available globally for the EDL protocol
        window.currentEDLLayerInfo = currentLayerInfo;
        
        // Update lastUsedForecastDate in metadata
        updateLastUsedForecastDate(forecastDate);
        
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
 * @param {string} [forecastDate] - Optional forecast date. If not provided, uses the current forecastDate
 * @returns {boolean} Success status
 */
export function updateEDLLayer(date, hour, pressure, forecastDate) {
    // If forecastDate not provided, use the current one from currentLayerInfo
    forecastDate = forecastDate || (currentLayerInfo ? currentLayerInfo.forecastDate : null);
    
    console.log(`[EDL] Updating EDL layer - forecastDate: ${forecastDate}, targetDate: ${date}, hour: ${hour}, pressure: ${pressure}`);
    
    // Check if EDL tiles are available
    if (!hasEDLTiles()) {
        console.warn('[EDL] No EDL tiles available, cannot update layer');
        return false;
    }
    
    // Verify that the requested parameters exist in metadata
    const metadata = getEDLMetadata();
    
    if (!forecastDate) {
        forecastDate = metadata.lastUsedForecastDate || getLatestForecastDate(metadata);
    }
    
    if (!forecastDate || !metadata.availableLayers[forecastDate]) {
        console.warn(`[EDL] Forecast date ${forecastDate} not available in metadata`);
        return false;
    }
    
    const forecastExists = metadata.availableLayers[forecastDate];
    const dateExists = forecastExists && metadata.availableLayers[forecastDate][date];
    const hourExists = dateExists && metadata.availableLayers[forecastDate][date][hour];
    const pressureExists = hourExists && metadata.availableLayers[forecastDate][date][hour].includes(pressure);
    
    if (!forecastExists || !dateExists || !hourExists || !pressureExists) {
        console.warn(`[EDL] Requested parameters not available - forecastDate: ${forecastDate}, targetDate: ${date}, hour: ${hour}, pressure: ${pressure}`);
        return false;
    }
    
    try {
        // Use the EDL protocol instead of file paths
        const tileProtocolUrl = `edl://tiles/${forecastDate}/{z}/{x}/{y}`;
        
        console.log(`[EDL] Using EDL protocol URL: ${tileProtocolUrl}`);
        
        const layerManager = getLayerManager();
        
        // Add/update the source with new protocol URL and zoom level constraints
        layerManager.addOrUpdateSource('edl-source', {
            type: 'raster',
            tiles: [tileProtocolUrl],
            tileSize: 256,
            minzoom: 6,
            maxzoom: 8
        });
        
        console.log(`[EDL] Updated EDL source with protocol URL: ${tileProtocolUrl}`);
        
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
            forecastDate,
            date, 
            hour,
            pressure
        };
        
        // Make current layer info available globally for the EDL protocol
        window.currentEDLLayerInfo = currentLayerInfo;
        
        // Update lastUsedForecastDate in metadata
        updateLastUsedForecastDate(forecastDate);
        
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
 * @param {string} [forecastDate] - Optional forecast date
 * @returns {Array} Available pressure levels in hPa
 */
export function getAvailablePressureLevels(date, hour, forecastDate) {
    // If forecastDate not provided, use the current one or from metadata
    if (!forecastDate && currentLayerInfo && currentLayerInfo.forecastDate) {
        forecastDate = currentLayerInfo.forecastDate;
    }
    
    // Check metadata first
    const metadata = getEDLMetadata();
    if (!forecastDate && metadata) {
        forecastDate = metadata.lastUsedForecastDate || getLatestForecastDate(metadata);
    }
    
    if (metadata && metadata.availableLayers && 
        metadata.availableLayers[forecastDate] && 
        metadata.availableLayers[forecastDate][date] && 
        metadata.availableLayers[forecastDate][date][hour]) {
        return metadata.availableLayers[forecastDate][date][hour];
    }
    
    // Return default pressure levels if none found in metadata
    return PRESSURE_LEVELS;
}

/**
 * Gets available hours for a given date
 * @param {string} date - Date string in YYYY-MM-DD format
 * @param {string} [forecastDate] - Optional forecast date
 * @returns {Array} Available hours
 */
export function getAvailableHours(date, forecastDate) {
    // If forecastDate not provided, use the current one or from metadata
    if (!forecastDate && currentLayerInfo && currentLayerInfo.forecastDate) {
        forecastDate = currentLayerInfo.forecastDate;
    }
    
    // Check metadata
    const metadata = getEDLMetadata();
    if (!forecastDate && metadata) {
        forecastDate = metadata.lastUsedForecastDate || getLatestForecastDate(metadata);
    }
    
    if (metadata && metadata.availableLayers && 
        metadata.availableLayers[forecastDate] && 
        metadata.availableLayers[forecastDate][date]) {
        return Object.keys(metadata.availableLayers[forecastDate][date])
            .map(h => parseInt(h))
            .sort((a, b) => a - b);
    }
    
    return [];
}

/**
 * Gets available target dates for a given forecast date
 * @param {string} [forecastDate] - Optional forecast date
 * @returns {Array} Available dates
 */
export function getAvailableTargetDates(forecastDate) {
    // If forecastDate not provided, use the current one or from metadata
    if (!forecastDate && currentLayerInfo && currentLayerInfo.forecastDate) {
        forecastDate = currentLayerInfo.forecastDate;
    }
    
    // Check metadata
    const metadata = getEDLMetadata();
    if (!forecastDate && metadata) {
        forecastDate = metadata.lastUsedForecastDate || getLatestForecastDate(metadata);
    }
    
    if (metadata && metadata.availableLayers && metadata.availableLayers[forecastDate]) {
        return Object.keys(metadata.availableLayers[forecastDate]).sort();
    }
    
    return [];
}

/**
 * Gets available forecast dates
 * @returns {Array} Available forecast dates
 */
export function getAvailableForecastDates() {
    const metadata = getEDLMetadata();
    
    if (metadata && metadata.availableLayers) {
        return Object.keys(metadata.availableLayers).sort((a, b) => new Date(b) - new Date(a));
    }
    
    return [];
}

/**
 * Gets the latest forecast date from metadata
 * @param {Object} metadata - The EDL metadata object
 * @returns {string|null} The latest forecast date or null if none available
 */
export function getLatestForecastDate(metadata) {
    if (!metadata || !metadata.availableLayers) return null;
    
    const forecastDates = Object.keys(metadata.availableLayers);
    if (forecastDates.length === 0) return null;
    
    // Sort dates in descending order (newest first)
    forecastDates.sort((a, b) => new Date(b) - new Date(a));
    return forecastDates[0];
}

/**
 * Updates the last used forecast date in the metadata
 * @param {string} forecastDate - The forecast date to save
 */
function updateLastUsedForecastDate(forecastDate) {
    if (!forecastDate) return;
    
    try {
        const metadataStr = localStorage.getItem('edl_metadata');
        if (!metadataStr) return;
        
        const metadata = JSON.parse(metadataStr);
        if (!metadata || !metadata.availableLayers) return;
        
        metadata.lastUsedForecastDate = forecastDate;
        localStorage.setItem('edl_metadata', JSON.stringify(metadata));
        console.log(`[EDL] Updated lastUsedForecastDate to: ${forecastDate}`);
    } catch (error) {
        console.error('[EDL] Error updating lastUsedForecastDate:', error);
    }
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
        const expectedDir = `edl_tiles/${currentLayerInfo.forecastDate}/${currentLayerInfo.date}_${currentLayerInfo.hour}_${currentLayerInfo.pressure}`;
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