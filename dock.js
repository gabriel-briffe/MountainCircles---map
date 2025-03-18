/**
 * Dock module for MountainCircles Map
 * Contains functions for dock UI elements, controls, and interactions
 */

// Import from state management
import {
    getMap,
    getLayerManager,
    getLayersToggleState,
    setLayersToggleState,
    getPolygonOpacity,
    setPolygonOpacity,
    saveStateToLocalStorage
} from "./state.js";

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
 * Updates the visibility icon based on layer toggle state
 */
export function updateVisibilityIcon() {
    const toggleState = getLayersToggleState();
    document.getElementById('visibilityIcon').textContent = toggleState ? 'visibility' : 'visibility_off';
}

/**
 * Toggles the visibility of line string layers
 */
export function toggleLayerVisibility() {
    // Toggle the state first
    const currentState = getLayersToggleState();
    const newState = !currentState;
    setLayersToggleState(newState);
    
    // Update the icon
    updateVisibilityIcon();
    
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
 * Sets up all dock event listeners
 */
export function setupDockEventListeners() {
    // Polygon opacity slider
    const polygonOpacitySlider = document.getElementById('polygonOpacitySlider');
    
    // Set initial value from state
    polygonOpacitySlider.value = getPolygonOpacity();
    
    // Create a debounced save function that waits 300ms after slider movement stops
    const debouncedSaveState = debounce(() => {
        saveStateToLocalStorage().catch(err => console.error('Error saving state:', err));
    }, 300);
    
    polygonOpacitySlider.addEventListener('input', function() {
        const opacity = parseFloat(this.value);
        // Update the layer immediately
        getLayerManager().setPaintProperty('polygons-layer', 'fill-opacity', opacity);
        // Store in state immediately
        setPolygonOpacity(opacity);
        // Debounce the save operation
        debouncedSaveState();
    });

    // Layer visibility toggle
    document.getElementById('toggleLayerButton').addEventListener('click', toggleLayerVisibility);

    // Sidebar toggle
    document.getElementById('toggleSidebarButton').addEventListener('click', () => {
        // Import toggleSidebar dynamically to avoid circular dependencies
        import('./sidebar.js').then(module => {
            module.toggleSidebar();
        });
    });

    // Zoom controls
    document.getElementById('zoomInBtn').addEventListener('click', () => {
        getMap().zoomIn();
    });
    document.getElementById('zoomOutBtn').addEventListener('click', () => {
        getMap().zoomOut();
    });
    
    // Ensure visibility icon matches the current state
    updateVisibilityIcon();
} 