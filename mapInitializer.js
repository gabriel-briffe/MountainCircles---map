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
    getBaseTextSize
} from "./state.js";

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
        ...MAP_SETTINGS
    });

    // Set the map in state
    setMap(mapInstance);

    // Set up map load event handler
    mapInstance.on('load', async () => {
        // Initialize the layer manager
        const layerManagerInstance = new LayerManager(mapInstance);
        
        // Initialize the state
        initState({
            map: mapInstance,
            layerManager: layerManagerInstance,
            baseTextSize: DEFAULT_TEXT_SIZE,
            peaksVisible: DEFAULT_PEAKS_VISIBLE,
            passesVisible: DEFAULT_PASSES_VISIBLE,
            currentPolicy: DEFAULT_POLICY,
            currentConfig: DEFAULT_CONFIG
        });
        
        console.log('Map load event triggered');
        
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
            ensureAirspaceLayersOnTop();
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
    
    console.log('Added peaks and passes sources');

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
    getLayerManager().addLayerIfNotExists('location-marker-circle', locationMarkerStyle);

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
    
    // Setup geolocation tracking if available
    setupGeolocation();
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
    
    console.log('Triangle images loaded');
    getMap().addImage('peak-triangle', peakImage);
    getMap().addImage('pass-triangle', passImage);
    console.log('Added triangle images to map');

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
    
    console.log('Added peaks and passes symbol layers');
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
    
    // After adding a dynamic layer, ensure airspace layers remain on top
    ensureAirspaceLayersOnTop();
    
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
 * Sets up geolocation tracking if available
 */
function setupGeolocation() {
    if ('geolocation' in navigator) {
        const options = {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        };
        
        navigator.geolocation.watchPosition(
            updateLocation,
            (error) => {
                console.error('Error getting location:', error);
            },
            options
        );
    } else {
        console.warn('Geolocation is not supported by this browser.');
    }
}

/**
 * Updates the user's location on the map
 * @param {Object} position - Geolocation position object
 */
function updateLocation(position) {
    if (!getLayerManager().hasSource('location-marker')) {
        console.warn('Location marker source not found');
        return;
    }
    
    const coords = [position.coords.longitude, position.coords.latitude];
    
    getLayerManager().addOrUpdateSource('location-marker', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: coords
            }
        }
    });
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
    
    // Hide zoom buttons on all mobile devices regardless of standalone mode
    if (isMobileDevice()) {
        document.getElementById('zoomInBtn').style.display = 'none';
        document.getElementById('zoomOutBtn').style.display = 'none';
    }
    
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

/**
 * Ensures airspace layers are always on top of other layers
 * This function should be called after all map layers are added
 */
export function ensureAirspaceLayersOnTop() {
    const layerManager = getLayerManager();
    
    // Move airspace fill and outline layers to the top
    // This ensures they appear above all other layers
    layerManager.moveLayerToTop('airspace-outline');
    layerManager.moveLayerToTop('airspace-fill');
    
    // Move highlight layer above airspace layers
    layerManager.moveLayerToTop('highlight-airspace');
    
    console.log('Moved airspace layers to the top of the rendering order');
} 