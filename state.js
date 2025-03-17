/**
 * State management for MountainCircles Map
 * Centralizes application state and provides getters/setters
 */

import { DEFAULT_TEXT_SIZE, DEFAULT_PEAKS_VISIBLE, DEFAULT_PASSES_VISIBLE, DEFAULT_POLICY, DEFAULT_CONFIG } from './config.js';

// Private state object
const _state = {
    // Map related
    map: null,
    layerManager: null,
    
    // Text size
    baseTextSize: DEFAULT_TEXT_SIZE,
    
    // Layer visibility
    peaksVisible: DEFAULT_PEAKS_VISIBLE,
    passesVisible: DEFAULT_PASSES_VISIBLE,
    
    // Popup state
    lastPopupLngLat: null,
    highlightedFeatureKey: null,
    popupMarker: null,
    popup: null,
    crossSectionContainer: null,
    
    // Airspace data
    airspaceData: null,
    
    // Configuration
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