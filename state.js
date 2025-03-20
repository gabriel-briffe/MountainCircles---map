/**
 * State management for MountainCircles Map
 * Centralizes application state and provides getters/setters
 */

import { DEFAULT_TEXT_SIZE, DEFAULT_PEAKS_VISIBLE, DEFAULT_PASSES_VISIBLE, DEFAULT_POLICY, DEFAULT_CONFIG } from './config.js';

// Define which state properties should be persisted
const PERSISTED_STATE_KEYS = [
    'baseTextSize',
    'peaksVisible',
    'passesVisible',
    'polygonOpacity',
    'layersToggleState',
    'currentPolicy',
    'currentConfig',
    'airspaceVisible',
    'geolocationEnabled',      // Add geolocation state to persisted keys
    'navboxesEnabled'          // Add navboxes state to persisted keys
];

// Threshold for position staleness in milliseconds
// After this time without a new position, we'll show warning/error
export const POSITION_WARNING_THRESHOLD = 5000; // 5 seconds for warning (orange)
export const POSITION_ERROR_THRESHOLD = 10000; // 10 seconds for error (red)

// Possible geolocation error states
export const GEOLOCATION_STATE = {
    OK: 'ok',               // Working normally
    WARNING: 'warning',     // Stale position < threshold
    ERROR: 'error'          // Stale position > threshold or permission denied
};

// Private state object
const _state = {
    // Map related - these will be set during initialization
    map: null,
    layerManager: null,
    
    // Text size
    baseTextSize: DEFAULT_TEXT_SIZE,
    
    // Layer visibility
    peaksVisible: DEFAULT_PEAKS_VISIBLE,
    passesVisible: DEFAULT_PASSES_VISIBLE,
    airspaceVisible: true, // Default to visible
    
    // Opacity settings
    polygonOpacity: 0.1,
    
    // Popup state
    lastPopupLngLat: null,
    highlightedFeatureKey: null,
    popupMarker: null,
    popup: null,
    crossSectionContainer: null,
    
    // Airspace data
    airspaceData: null,
    
    // Configuration - critical for aviation safety
    currentPolicy: DEFAULT_POLICY,
    currentConfig: DEFAULT_CONFIG,
    
    // Features
    features: null,

    // Section and bar references
    sectionRefs: new Map(),
    barRefs: new Map(),

    // Visualization parameters
    maxUpperLimit: 6000,
    barWidth: 20,
    barSpacing: 5,
    
    // Calculated visualization data
    columns: [],
    altitudeSet: new Set(),

    // Toggle state
    layersToggleState: true,
    
    // Airspace type visibility
    enabledAirspaceTypes: null,
    
    // Geolocation enabled/disabled
    geolocationEnabled: false,  // Default to disabled for privacy reasons
    
    // Navboxes enabled/disabled
    navboxesEnabled: false,  // Default to disabled, depends on geolocation
    
    // Geolocation quality tracking
    lastSuccessfulPositionTime: null,
    geolocationErrorState: GEOLOCATION_STATE.OK,
    lastPositionError: null
};

// State getters
export const getMap = () => _state.map;
export const getLayerManager = () => _state.layerManager;
export const getBaseTextSize = () => _state.baseTextSize;
export const getPeaksVisible = () => _state.peaksVisible;
export const getPassesVisible = () => _state.passesVisible;
export const getLastPopupLngLat = () => _state.lastPopupLngLat;
export const getHighlightedFeatureKey = () => _state.highlightedFeatureKey;
export const getPopupMarker = () => _state.popupMarker;
export const getAirspaceData = () => _state.airspaceData;
export const getCurrentPolicy = () => _state.currentPolicy;
export const getCurrentConfig = () => _state.currentConfig;
export const getPopup = () => _state.popup;
export const getCrossSectionContainer = () => _state.crossSectionContainer;
export const getFeatures = () => _state.features;
export const getSectionRefs = () => _state.sectionRefs;
export const getBarRefs = () => _state.barRefs;

// Visualization parameter getters
export const getMaxUpperLimit = () => _state.maxUpperLimit;
export const getBarWidth = () => _state.barWidth;
export const getBarSpacing = () => _state.barSpacing;
export const getColumns = () => _state.columns;
export const getAltitudeSet = () => _state.altitudeSet;

// State setters
export const setMap = (map) => { _state.map = map; };
export const setLayerManager = (layerManager) => { _state.layerManager = layerManager; };
export const setBaseTextSize = (size) => { _state.baseTextSize = size; };
export const setPeaksVisible = (visible) => { _state.peaksVisible = visible; };
export const setPassesVisible = (visible) => { _state.passesVisible = visible; };
export const setLastPopupLngLat = (lngLat) => { _state.lastPopupLngLat = lngLat; };
export const setHighlightedFeatureKey = (key) => { _state.highlightedFeatureKey = key; };
export const setPopupMarker = (marker) => { _state.popupMarker = marker; };
export const setAirspaceData = (data) => { _state.airspaceData = data; };
export const setCurrentPolicy = (policy) => { _state.currentPolicy = policy; };
export const setCurrentConfig = (config) => { _state.currentConfig = config; };
export const setPopup = (popup) => { _state.popup = popup; };
export const setCrossSectionContainer = (container) => { _state.crossSectionContainer = container; };
export const setFeatures = (features) => { _state.features = features; };
export const setSectionRef = (index, ref) => { _state.sectionRefs.set(index, ref); };
export const setBarRef = (index, ref) => { _state.barRefs.set(index, ref); };

// Visualization parameter setters
export const setMaxUpperLimit = (limit) => { _state.maxUpperLimit = limit; };
export const setBarWidth = (width) => { _state.barWidth = width; };
export const setBarSpacing = (spacing) => { _state.barSpacing = spacing; };
export const setColumns = (columns) => { _state.columns = columns; };
export const setAltitudeSet = (altitudeSet) => { _state.altitudeSet = altitudeSet; };

// Compound setters
export const setPopupState = (state) => {
    if (state.lastPopupLngLat !== undefined) _state.lastPopupLngLat = state.lastPopupLngLat;
    if (state.popupMarker !== undefined) _state.popupMarker = state.popupMarker;
    if (state.highlightedFeatureKey !== undefined) _state.highlightedFeatureKey = state.highlightedFeatureKey;
};

// Helper functions
export const clearPopupState = () => {
    _state.lastPopupLngLat = null;
    _state.highlightedFeatureKey = null;
    _state.popupMarker = null;
};

export const clearPopup = () => {
    if (_state.popup) {
        _state.popup.remove();
        _state.popup = null;
    }
    _state.crossSectionContainer = null;
};

export const clearFeatures = () => { _state.features = null; };

export const clearRefs = () => {
    _state.sectionRefs.clear();
    _state.barRefs.clear();
    _state.columns = [];
    _state.altitudeSet.clear();
    _state.crossSectionContainer = null;
};

// State initialization
export const initState = (initialState = {}) => {
    Object.keys(initialState).forEach(key => {
        if (key in _state) {
            _state[key] = initialState[key];
        }
    });
};

// Get complete state (for debugging)
export const getState = () => ({ ..._state });

/**
 * Gets the current layers toggle state
 * @returns {boolean} The current toggle state (true = on, false = off)
 */
export function getLayersToggleState() {
    return _state.layersToggleState;
}

/**
 * Sets the layers toggle state
 * @param {boolean} state - The new toggle state
 */
export function setLayersToggleState(state) {
    _state.layersToggleState = state;
}

/**
 * Gets the current polygon opacity setting
 * @returns {number} The current polygon opacity
 */
export function getPolygonOpacity() {
    return _state.polygonOpacity;
}

/**
 * Sets the polygon opacity
 * @param {number} opacity - The opacity value between 0 and 1
 */
export function setPolygonOpacity(opacity) {
    _state.polygonOpacity = opacity;
}

/**
 * Saves persistable state to Cache API
 */
export async function saveStateToLocalStorage() {
    try {
        const persistedState = {};
        
        // Copy properties that should be persisted
        PERSISTED_STATE_KEYS.forEach(key => {
            if (key in _state) {
                persistedState[key] = _state[key];
            }
        });

        // Handle special case for airspace types
        if (_state.enabledAirspaceTypes) {
            persistedState.enabledAirspaceTypes = Array.from(_state.enabledAirspaceTypes);
        }
        
        // Convert state object to JSON string, then to Blob for caching
        const stateBlob = new Blob([JSON.stringify(persistedState)], {
            type: 'application/json'
        });
        
        // Create a response object from the blob
        const response = new Response(stateBlob);
        
        // Open the cache and store the state
        const cache = await caches.open('mountaincircles-state-v1');
        await cache.put('/app-state', response);
        
    } catch (error) {
        console.error('Failed to save state to Cache API:', error);
    }
}

/**
 * Loads state from Cache API
 * @returns {Promise<boolean>} Whether state was successfully loaded
 */
export async function loadStateFromLocalStorage() {
    try {
        // Open the cache
        const cache = await caches.open('mountaincircles-state-v1');
        
        // Try to get the state from cache
        const response = await cache.match('/app-state');
        if (!response) {
            return false;
        }
        
        // Parse the JSON from the response
        const savedState = await response.json();
        
        // Handle special case for enabledAirspaceTypes - convert array back to Set
        if (savedState.enabledAirspaceTypes) {
            _state.enabledAirspaceTypes = new Set(savedState.enabledAirspaceTypes);
            // Remove it from parsedState to avoid processing it twice
            delete savedState.enabledAirspaceTypes;
        }
        
        // Special handling for geolocation permissions
        // If geolocation was enabled in saved state, check if we have permission first
        if (savedState.geolocationEnabled === true && 'permissions' in navigator) {
            try {
                // Check current permission state
                const permissionStatus = await navigator.permissions.query({name: 'geolocation'});
                
                // If permission is denied, force geolocation to be disabled regardless of saved state
                if (permissionStatus.state === 'denied') {
                    savedState.geolocationEnabled = false;
                }
            } catch (permError) {
                console.warn('Could not check geolocation permission:', permError);
                // Fall back to directly checking geolocation availability
                if (!('geolocation' in navigator)) {
                    savedState.geolocationEnabled = false;
                }
            }
        }
        
        // Update state with saved values
        Object.keys(savedState).forEach(key => {
            if (key in _state) {
                _state[key] = savedState[key];
            }
        });
        
        return true;
    } catch (error) {
        console.error('Failed to load state from Cache API:', error);
        return false;
    }
}

/**
 * Clears all saved state from Cache API
 * This can be called in emergency situations where saved state might be causing issues
 */
export async function clearSavedState() {
    try {
        const cache = await caches.open('mountaincircles-state-v1');
        await cache.delete('/app-state');
        
        // Reset critical state values to defaults
        _state.currentPolicy = DEFAULT_POLICY;
        _state.currentConfig = DEFAULT_CONFIG;
        
        return true;
    } catch (error) {
        console.error('Failed to clear state from Cache API:', error);
        return false;
    }
}

/**
 * Gets the enabled airspace types
 * @returns {Set<string>} Set of enabled airspace type names
 */
export function getEnabledAirspaceTypes() {
    return _state.enabledAirspaceTypes;
}

/**
 * Sets the enabled airspace types
 * @param {Array<string>} types - Array of enabled airspace type names
 */
export function setEnabledAirspaceTypes(types) {
    _state.enabledAirspaceTypes = new Set(types);
    // Save to Cache API whenever we update this
    saveStateToLocalStorage().catch(err => console.error('Error saving airspace types state:', err));
}

/**
 * Gets whether airspace layers are visible
 * @returns {boolean} Whether airspace layers are visible
 */
export function getAirspaceVisible() {
    return _state.airspaceVisible;
}

/**
 * Sets visibility for airspace layers
 * @param {boolean} visible - Whether airspace layers should be visible
 */
export function setAirspaceVisible(visible) {
    _state.airspaceVisible = visible;
    // Save to Cache API whenever we update this
    saveStateToLocalStorage().catch(err => console.error('Error saving airspace visibility state:', err));
}

/**
 * Gets whether geolocation is enabled
 * @returns {boolean} Whether geolocation is enabled
 */
export function getGeolocationEnabled() {
    return _state.geolocationEnabled;
}

/**
 * Sets whether geolocation is enabled
 * @param {boolean} enabled - Whether geolocation should be enabled
 */
export function setGeolocationEnabled(enabled) {
    _state.geolocationEnabled = enabled;
    // Save to Cache API whenever we update this
    saveStateToLocalStorage().catch(err => console.error('Error saving geolocation state:', err));
}

/**
 * Gets whether navboxes are enabled
 * @returns {boolean} Whether navboxes are enabled
 */
export function getNavboxesEnabled() {
    return _state.navboxesEnabled;
}

/**
 * Sets whether navboxes are enabled
 * @param {boolean} enabled - Whether navboxes should be enabled
 */
export function setNavboxesEnabled(enabled) {
    _state.navboxesEnabled = enabled;
    // Save to Cache API whenever we update this
    saveStateToLocalStorage().catch(err => console.error('Error saving navboxes state:', err));
}

/**
 * Gets the timestamp of the last successful position update
 * @returns {number|null} Timestamp in milliseconds or null if no position received yet
 */
export function getLastSuccessfulPositionTime() {
    return _state.lastSuccessfulPositionTime;
}

/**
 * Sets the timestamp of the last successful position update
 * @param {number} timestamp - Timestamp in milliseconds
 */
export function setLastSuccessfulPositionTime(timestamp) {
    _state.lastSuccessfulPositionTime = timestamp;
}

/**
 * Gets the current geolocation error state
 * @returns {string} One of the GEOLOCATION_STATE values
 */
export function getGeolocationErrorState() {
    return _state.geolocationErrorState;
}

/**
 * Sets the current geolocation error state
 * @param {string} state - One of the GEOLOCATION_STATE values
 */
export function setGeolocationErrorState(state) {
    _state.geolocationErrorState = state;
}

/**
 * Gets the last position error
 * @returns {PositionError|null} The last position error or null
 */
export function getLastPositionError() {
    return _state.lastPositionError;
}

/**
 * Sets the last position error
 * @param {PositionError} error - The position error object
 */
export function setLastPositionError(error) {
    _state.lastPositionError = error;
}

/**
 * Checks the staleness of the last position and updates the error state
 * Should be called periodically to update the UI based on position age
 */
export function checkPositionStaleness() {
    const lastTime = getLastSuccessfulPositionTime();
    
    // If we've never received a position, return ERROR state
    if (!lastTime) {
        // Set the error state if it's not already set
        if (_state.geolocationErrorState !== GEOLOCATION_STATE.ERROR) {
            _state.geolocationErrorState = GEOLOCATION_STATE.ERROR;
        }
        return GEOLOCATION_STATE.ERROR;
    }
    
    const now = Date.now();
    const elapsed = now - lastTime;
    
    // Only update if we're not already in ERROR state (which is manual)
    if (_state.geolocationErrorState !== GEOLOCATION_STATE.ERROR) {
        if (elapsed > POSITION_ERROR_THRESHOLD) {
            _state.geolocationErrorState = GEOLOCATION_STATE.ERROR;
        } else if (elapsed > POSITION_WARNING_THRESHOLD) {
            _state.geolocationErrorState = GEOLOCATION_STATE.WARNING;
        } else {
            _state.geolocationErrorState = GEOLOCATION_STATE.OK;
        }
    }
    
    return _state.geolocationErrorState;
} 