/**
 * Dock module for MountainCircles Map
 * Contains functions for dock UI elements, controls, and interactions
 */

// Import from state management
import {
    getMap,
    getLayerManager,
} from "./state.js";

/**
 * Updates the visibility icon based on layer visibility
 */
export function updateVisibilityIcon() {
    const mainVisibility = getLayerManager().getVisibility('linestrings-layer');
    document.getElementById('visibilityIcon').textContent = mainVisibility === 'visible' ? 'visibility' : 'visibility_off';
}

/**
 * Toggles the visibility of line string layers
 */
export function toggleLayerVisibility() {
    const layerIds = ['linestrings-layer', 'linestrings-labels'];
    let newVisibility = 'visible';
    
    if (getLayerManager().hasLayer('linestrings-layer')) {
        const currentVisibility = getLayerManager().getVisibility('linestrings-layer');
        newVisibility = currentVisibility === 'visible' ? 'none' : 'visible';
    }
    
    layerIds.forEach(id => {
        getLayerManager().setVisibility(id, newVisibility === 'visible');
    });
    
    updateVisibilityIcon();
}

/**
 * Sets up all dock event listeners
 */
export function setupDockEventListeners() {
    // Polygon opacity slider
    const polygonOpacitySlider = document.getElementById('polygonOpacitySlider');
    polygonOpacitySlider.addEventListener('input', function() {
        const opacity = parseFloat(this.value);
        getLayerManager().setPaintProperty('polygons-layer', 'fill-opacity', opacity);
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
} 