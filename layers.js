// Dynamic layer management for MountainCircles Map
import { 
    getMap, 
    getLayerManager, 
    getBaseTextSize,
    getCurrentConfig,
    getPopup,
    clearPopup,
    getLayersToggleState
} from "./state.js";

import { 
    dynamicLineLayerStyle, 
    dynamicLabelLayerStyle 
} from "./layerStyles.js";

import { updateVisibilityIcon } from "./dock.js";
import { clearMarker } from "./map.js";
import { clearHighlight } from "./airspace.js";

// Flag to track if a point was just clicked, to prevent airspace popup from showing
export let pointClickedFlag = false;

/**
 * Handles click events on map points
 * @param {Object} e - The click event object
 */
export function handlePointClick(e) {
    if (!e.features || !e.features.length) return;

    const feature = e.features[0];
    if (!feature.properties || !feature.properties.filename) {
        console.warn("Clicked feature missing 'filename' property:", feature);
        return;
    }

    // Check if layers toggle is on (using the independent state variable)
    const linestringsToggleOn = getLayersToggleState();
    
    if (linestringsToggleOn) {
        // When toggle is on, prevent airspace popup and handle dynamic layers
        pointClickedFlag = true;
        
        // Clear any existing popups or markers
        clearPopup();
        clearMarker();
        clearHighlight();
        
        // Reset the flag after a brief delay
        setTimeout(() => {
            pointClickedFlag = false;
        }, 200);
        
        const filePath = getCurrentConfig() + "/" + feature.properties.filename;
        const dynamicLayerId = 'dynamic-lines-' + getCurrentConfig() + '-' + feature.properties.filename;
        const dynamicSourceId = dynamicLayerId + '-source';
        const dynamicLabelId = dynamicLayerId + '-labels';

        // Hide all other dynamic layers
        hideOtherDynamicLayers(dynamicLayerId);

        if (getLayerManager().hasLayer(dynamicLayerId)) {
            toggleExistingDynamicLayer(dynamicLayerId, dynamicLabelId);
        } else {
            createNewDynamicLayer(filePath, dynamicLayerId, dynamicSourceId, dynamicLabelId);
        }
    } else {
        // When toggle is off, don't set the pointClickedFlag to allow the airspace popup
        clearPopup();
        clearMarker();
        clearHighlight();
    }

    // Update visibility icon
    updateVisibilityIcon();
}

/**
 * Hides all dynamic layers except the current one
 * @param {string} currentDynamicLayerId - The ID of the current dynamic layer to keep visible
 */
function hideOtherDynamicLayers(currentDynamicLayerId) {
    const currentLayers = getMap().getStyle().layers.slice();
    currentLayers.forEach(layer => {
        if (layer.id.startsWith('dynamic-lines-') && layer.id !== currentDynamicLayerId) {
            getLayerManager().setVisibility(layer.id, false);
            const otherLabelId = layer.id + '-labels';
            getLayerManager().setVisibility(otherLabelId, false);
        }
    });
}

/**
 * Toggles visibility of an existing dynamic layer
 * @param {string} dynamicLayerId - The ID of the dynamic layer
 * @param {string} dynamicLabelId - The ID of the dynamic layer's labels
 */
function toggleExistingDynamicLayer(dynamicLayerId, dynamicLabelId) {
    let currentVisibility = getLayerManager().getVisibility(dynamicLayerId);
    if (currentVisibility === 'visible') {
        // Hide dynamic layer and show main layers
        getLayerManager().setVisibility(dynamicLayerId, false);
        getLayerManager().setVisibility(dynamicLabelId, false);
        getLayerManager().setVisibility('linestrings-layer', true);
        getLayerManager().setVisibility('linestrings-labels', true);
    } else {
        // Show dynamic layer and hide main layers
        getLayerManager().setVisibility(dynamicLayerId, true);
        getLayerManager().setVisibility(dynamicLabelId, true);
        getLayerManager().setVisibility('linestrings-layer', false);
        getLayerManager().setVisibility('linestrings-labels', false);
    }
}

/**
 * Creates a new dynamic layer from a GeoJSON file
 * @param {string} filePath - Path to the GeoJSON file
 * @param {string} dynamicLayerId - ID for the new dynamic layer
 * @param {string} dynamicSourceId - ID for the new dynamic source
 * @param {string} dynamicLabelId - ID for the new dynamic label layer
 */
function createNewDynamicLayer(filePath, dynamicLayerId, dynamicSourceId, dynamicLabelId) {
    // Hide main layers
    getLayerManager().setVisibility('linestrings-layer', false);
    getLayerManager().setVisibility('linestrings-labels', false);
        
    // Add source
    getLayerManager().addOrUpdateSource(dynamicSourceId, {
        type: 'geojson',
        data: filePath
    });

    // Create a copy of the dynamic line style to update the source and id
    const lineStyle = { ...dynamicLineLayerStyle };
    lineStyle.id = dynamicLayerId;
    lineStyle.source = dynamicSourceId;
    lineStyle.filter = ['==', '$type', 'LineString'];

    // Create a copy of the dynamic label style to update the source, id, and text size
    const labelStyle = { ...dynamicLabelLayerStyle };
    labelStyle.id = dynamicLabelId;
    labelStyle.source = dynamicSourceId;
    labelStyle.filter = ['==', '$type', 'LineString'];
    labelStyle.minzoom = 8;
    labelStyle.layout = { ...dynamicLabelLayerStyle.layout };
    labelStyle.layout['text-size'] = getBaseTextSize();

    // Add layers
    getLayerManager().addLayerIfNotExists(dynamicLayerId, lineStyle);
    getLayerManager().addLayerIfNotExists(dynamicLabelId, labelStyle);
}

/**
 * Updates the visibility of a layer
 * @param {string} layerId - The ID of the layer to update
 * @param {boolean} visible - Whether the layer should be visible
 */
export function updateLayerVisibility(layerId, visible) {
    getLayerManager().setVisibility(layerId, visible);
}

/**
 * Sets up event handlers for layer-related interactions
 */
export function setupLayerEventHandlers() {
    // Set up click handler for points layer
    if (getLayerManager().hasLayer('points-layer-clickable')) {
        getMap().on('click', 'points-layer-clickable', handlePointClick);
    }
} 