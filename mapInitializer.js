/**
 * Map initialization module for MountainCircles Map
 * Handles map setup, layer creation, and initial configuration
 */

import style from "./airspaceStyle.js";
import { LayerManager } from "./LayerManager.js";
import { isRunningStandalone, isMobileDevice, isIOS } from "./utils.js";
import { 
    peaksSymbolsLayerStyle, 
    passesSymbolsLayerStyle,
    locationMarkerStyle,
    highlightAirspaceStyle,
    dynamicLineLayerStyle,
    dynamicLabelLayerStyle
} from "./layerStyles.js";
import { setupGeolocation } from "./location.js";

import {
    MAP_BOUNDS,
    MAP_MAX_BOUNDS,
    MAP_SETTINGS,
    DEFAULT_TEXT_SIZE,
    DEFAULT_PEAKS_VISIBLE,
    DEFAULT_PASSES_VISIBLE,
    DEFAULT_POLICY,
    DEFAULT_CONFIG
} from "./config.js";

import {
    setMap,
    initState,
    getMap,
    getLayerManager,
    getBaseTextSize,
    setLayersToggleState,
    getGeolocationEnabled
} from "./state.js";

// Default settings
const DEFAULT_LAYERS_TOGGLE_STATE = true;

/**
 * Initializes the map and sets up basic layers
 * @param {string} containerId - ID of the HTML element to contain the map
 * @param {Function} onMapReady - Callback function to execute when map is loaded
 * @returns {Object} The initialized map instance
 */
export function initializeMap(containerId, onMapReady) {
    // Initialize the map
    const mapInstance = new maplibregl.Map({
        container: containerId,
        style: style,
        bounds: MAP_BOUNDS,
        maxBounds: MAP_MAX_BOUNDS,
        doubleClickZoom: false,
        ...MAP_SETTINGS
    });

    // Set the map in state
    setMap(mapInstance);

    // Set up map load event handler
    mapInstance.on('load', async () => {
        // Initialize the layer manager
        const layerManagerInstance = new LayerManager(mapInstance);
        
        // Initialize the state with only map-related objects
        // Note: We don't set config here anymore - it's either loaded from localStorage
        // or already initialized with defaults in state.js
        initState({
            map: mapInstance,
            layerManager: layerManagerInstance
        });
        
        // Initialize basic map layers
        await initializeBaseLayers();
        
        // Set up UI elements
        setupUIElements();
        
        // Call the onMapReady callback if provided
        if (typeof onMapReady === 'function') {
            onMapReady(mapInstance);
        }
        
        // Ensure airspace layers are always on top after all callbacks and layers are added
        mapInstance.once('idle', () => {
            getLayerManager().redrawLayersInOrder();
            
            // Update the visibility icon to match the current state
            import('./dock.js').then(module => {
                module.updateVisibilityIcon();
            });
        });
    });

    return mapInstance;
}

/**
 * Initializes the basic map layers (peaks, passes, location marker)
 */
async function initializeBaseLayers() {
    // Add peaks and passes sources
    getLayerManager().addOrUpdateSource('peaks', {
        type: 'geojson',
        data: 'peaks.geojson'
    });
    
    getLayerManager().addOrUpdateSource('passes', {
        type: 'geojson',
        data: 'passes.geojson'
    });
    
    // Create triangle icons for peaks and passes
    await createMapIcons();
    
    // Add location marker
    getLayerManager().addOrUpdateSource('location-marker', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [0, 0]
            }
        }
    });

    // Add location marker layer
    getLayerManager().addLayerIfNotExists('location-marker-triangle', locationMarkerStyle);

    // Add highlight layer for airspace popups
    getLayerManager().addOrUpdateSource('highlight-airspace-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });

    // Add highlight layer
    getLayerManager().addLayerIfNotExists('highlight-airspace', highlightAirspaceStyle);
    
    // Add empty source for dynamic layers
    getLayerManager().addOrUpdateSource('dynamic-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });
    
    // Setup geolocation tracking only if enabled in settings and on mobile device
    if ((window.APP_CONFIG?.isMobile || isMobileDevice()) && getGeolocationEnabled()) {
        setupGeolocation();
    } 
}

/**
 * Creates triangle icons for peaks and passes
 */
async function createMapIcons() {
    const size = 15;
    const peakImage = new Image(size, size);
    const passImage = new Image(size, size);
    const peakCanvas = document.createElement('canvas');
    const passCanvas = document.createElement('canvas');
    peakCanvas.width = size;
    peakCanvas.height = size;
    passCanvas.width = size;
    passCanvas.height = size;
    const peakContext = peakCanvas.getContext('2d');
    const passContext = passCanvas.getContext('2d');
    
    peakContext.beginPath();
    peakContext.moveTo(size/2, 0);
    peakContext.lineTo(size, size);
    peakContext.lineTo(0, size);
    peakContext.closePath();
    peakContext.fillStyle = '#FF8C00';
    peakContext.fill();
    
    passContext.beginPath();
    passContext.moveTo(0, 0);
    passContext.lineTo(size, 0);
    passContext.lineTo(size/2, size);
    passContext.closePath();
    passContext.fillStyle = '#006400';
    passContext.fill();
    
    peakImage.src = peakCanvas.toDataURL();
    passImage.src = passCanvas.toDataURL();
    
    await Promise.all([
        new Promise(resolve => peakImage.onload = resolve),
        new Promise(resolve => passImage.onload = resolve)
    ]);
    
    const map = getMap();
    map.addImage('peak-triangle', peakImage);
    map.addImage('pass-triangle', passImage);
    
    // Create a copy of the style to update the text-size with the current base text size
    const peaksStyle = { ...peaksSymbolsLayerStyle };
    peaksStyle.layout = { ...peaksSymbolsLayerStyle.layout };
    peaksStyle.layout['text-size'] = getBaseTextSize();

    // Add peaks layer
    getLayerManager().addLayerIfNotExists('peaks-symbols', peaksStyle);

    // Create a copy of the style to update the text-size with the current base text size
    const passesStyle = { ...passesSymbolsLayerStyle };
    passesStyle.layout = { ...passesSymbolsLayerStyle.layout };
    passesStyle.layout['text-size'] = getBaseTextSize();

    // Add passes layer
    getLayerManager().addLayerIfNotExists('passes-symbols', passesStyle);
}

/**
 * Creates a dynamic layer with the given ID and style
 * @param {string} id - The ID for the new layer
 * @param {Object} style - The style object for the layer
 * @param {Object} data - The GeoJSON data for the layer
 */
export function createDynamicLayer(id, style, data) {
    // Add or update the source with the provided data
    getLayerManager().addOrUpdateSource(`dynamic-${id}-source`, {
        type: 'geojson',
        data: data
    });
    
    // Create a complete layer style by combining the base style with the source and id
    const layerStyle = {
        ...style,
        id: `dynamic-${id}`,
        source: `dynamic-${id}-source`
    };
    
    // If it's a label layer, update the text size
    if (style.layout && style.layout['text-size']) {
        layerStyle.layout = { ...style.layout };
        layerStyle.layout['text-size'] = getBaseTextSize();
    }
    
    // Add the layer to the map
    getLayerManager().addLayerIfNotExists(`dynamic-${id}`, layerStyle);
    
    return `dynamic-${id}`;
}

/**
 * Creates a dynamic line layer with labels
 * @param {string} id - Base ID for the layers
 * @param {Object} lineData - GeoJSON data for the line
 * @returns {Array} Array of layer IDs created
 */
export function createDynamicLineWithLabels(id, lineData) {
    const lineLayerId = createDynamicLayer(`${id}-line`, dynamicLineLayerStyle, lineData);
    const labelLayerId = createDynamicLayer(`${id}-label`, dynamicLabelLayerStyle, lineData);
    
    return [lineLayerId, labelLayerId];
}

/**
 * Sets up UI elements for the map
 */
function setupUIElements() {
    // Ensure airspace sidebar is initially hidden
    document.getElementById('airspace-sidebar').style.display = 'none';
    
    // Setup cache buttons visibility
    const cacheButton = document.getElementById('cacheCurrentConfigBtn');
    const mapCacheButton = document.getElementById('cacheBackgroundMapBtn');
    const cacheContainer = cacheButton.parentElement;
    const mapCacheContainer = mapCacheButton.parentElement;

    [cacheContainer, mapCacheContainer].forEach(container => {
        container.style.display = 'none';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        container.style.gap = '5px';
        container.style.marginBottom = '15px';
        container.style.width = '100%';
    });

    // Show cache options only when in standalone mode on mobile
    if (isRunningStandalone() && isMobileDevice()) {
        cacheContainer.style.display = 'flex';
        mapCacheContainer.style.display = 'flex';
    }
    
    // No longer hiding zoom buttons here, as they will now only be created on desktop
    
    // Setup iOS install prompt if needed
    if (isIOS()) {
        const installPrompt = document.getElementById('installPrompt');
        installPrompt.innerHTML = `
        <p>To install this app, tap the share button in Safari and then select "Add to Home Screen".</p>
        <button id="closeInstallPrompt" style="background: #666; color: #fff; padding: 8px 16px; border: none; border-radius: 4px;">Close</button>
        `;
        installPrompt.style.display = 'block';

        document.getElementById('closeInstallPrompt').addEventListener('click', function() {
            installPrompt.style.display = 'none';
        });
    }
} 