/**
 * Circles UI module for MountainCircles Map
 * Handles UI elements for controlling circles layers
 */

import {
    getMap,
    getLayerManager,
    getLayersToggleState,
    setLayersToggleState,
    getPolygonOpacity,
    setPolygonOpacity,
    saveStateToLocalStorage
} from "./state.js";

// Flag to track Circles navigation row visibility
let circlesNavigationVisible = false;

// DOM references
let opacitySlider = null;
let visibilityButton = null;

/**
 * Creates a debounced version of a function
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce time in milliseconds
 * @returns {Function} - The debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

/**
 * Updates the parameters box visibility based on current conditions
 * Hides parameters box when circles visibility is off OR opacity is 0
 */
function updateParametersBoxVisibility() {
    const isVisible = getLayersToggleState();
    const opacity = getPolygonOpacity();
    
    // Hide parameters box if layers are invisible OR opacity is 0
    if (!isVisible && opacity === 0) {
        document.body.classList.add('parameters-hidden');
    } else {
        document.body.classList.remove('parameters-hidden');
    }
}

/**
 * Initializes the Circles UI
 */
export function initCirclesUI() {
    console.log('[CirclesUI] Initializing Circles UI');
    
    // Get DOM references
    opacitySlider = document.getElementById('circlesOpacitySlider');
    visibilityButton = document.getElementById('circlesVisibilityBtn');
    
    // Set initial values
    if (opacitySlider) {
        opacitySlider.value = getPolygonOpacity();
    }
    
    // Set initial visibility icon
    updateVisibilityIcon();
    
    // Apply initial parameters box visibility
    updateParametersBoxVisibility();
    
    // Add event listeners
    setupEventListeners();
}

/**
 * Sets up event listeners for Circles UI elements
 */
function setupEventListeners() {
    // Create a debounced save function that waits 300ms after slider movement stops
    const debouncedSaveState = debounce(() => {
        saveStateToLocalStorage().catch(err => console.error('Error saving state:', err));
    }, 300);
    
    // Opacity slider
    if (opacitySlider) {
        opacitySlider.addEventListener('input', function() {
            const opacity = parseFloat(this.value);
            // Update the layer immediately
            getLayerManager().setPaintProperty('polygons-layer', 'fill-opacity', opacity);
            // Store in state immediately
            setPolygonOpacity(opacity);
            // Update parameters box visibility based on opacity
            updateParametersBoxVisibility();
            // Debounce the save operation
            debouncedSaveState();
        });
    }
    
    // Visibility button
    if (visibilityButton) {
        visibilityButton.addEventListener('click', toggleLayerVisibility);
    }
}

/**
 * Updates the visibility icon based on layer toggle state
 */
export function updateVisibilityIcon() {
    const toggleState = getLayersToggleState();
    const icon = document.getElementById('circlesVisibilityIcon');
    if (icon) {
        icon.textContent = toggleState ? 'visibility' : 'visibility_off';
    }
}

/**
 * Toggles the visibility of circles layers
 */
export function toggleLayerVisibility() {
    // Toggle the state first
    const currentState = getLayersToggleState();
    const newState = !currentState;
    setLayersToggleState(newState);
    
    // Update the icon
    updateVisibilityIcon();
    
    // Update parameters box visibility based on new state and current opacity
    updateParametersBoxVisibility();
    
    // Now set layer visibility based on the new state
    const layerIds = ['linestrings-layer', 'linestrings-labels'];
    const newVisibility = newState ? 'visible' : 'none';
    
    // Set visibility of main layers
    layerIds.forEach(id => {
        if (getLayerManager().hasLayer(id)) {
            getLayerManager().setVisibility(id, newState);
        }
    });
    
    // If turning visibility off, also hide all dynamic layers
    if (!newState) {
        const map = getMap();
        const style = map.getStyle();
        if (style && style.layers) {
            style.layers.forEach(layer => {
                if (layer.id.startsWith('dynamic-lines-')) {
                    getLayerManager().setVisibility(layer.id, false);
                }
            });
        }
    }
    
    // Save state to Cache API
    saveStateToLocalStorage().catch(err => console.error('Error saving state:', err));
}

/**
 * Toggles the visibility of the Circles navigation row
 */
export function toggleCirclesNavigationRow(visible) {
    const navRow = document.getElementById('circlesNavRow');
    if (navRow) {
        navRow.style.display = visible ? 'flex' : 'none';
    }
}

/**
 * Exports the current polygon opacity
 */
export function getCirclesOpacity() {
    return getPolygonOpacity();
}

/**
 * Updates the CirclesUI opacity slider value
 * @param {number} opacity - The opacity value to set
 */
export function updateOpacitySlider(opacity) {
    if (opacitySlider) {
        opacitySlider.value = opacity;
        // Update parameters box visibility when opacity is set programmatically
        updateParametersBoxVisibility();
    }
}
