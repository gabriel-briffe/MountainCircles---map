// Map functionality for MountainCircles Map
import {
    getMap,
    getLayerManager,
    getPopupMarker,
    setPopupMarker,
    setLastPopupLngLat,
    getPopup,
    clearPopup
} from "./state.js";

import {
    filterMapFeatures,
    fetchAirspaceData,
    createAirspacePopup,
    clearHighlight
} from "./airspace.js";

/**
 * Removes the popup marker if it exists
 */
function clearMarker() {
    const marker = getPopupMarker();
    if (marker) {
        marker.remove();
        setPopupMarker(null);
    }
}

/**
 * Closes the sidebar if it's open
 */
function closeSidebarIfOpen() {
    const sidebar = document.getElementById('airspace-sidebar');
    if (sidebar && sidebar.style.display === 'block') {
        sidebar.style.display = 'none';
        return true;
    }
    return false;
}

/**
 * Sets up the airspace popup click handler on the map
 * @param {Object} mapInstance - The map instance
 */
export function setupAirspacePopupHandler(mapInstance) {
    // Add click handler for airspace popups
    mapInstance.on('click', async function(e) {
        const map = getMap();
        
        // Close the sidebar if it's open
        if (closeSidebarIfOpen()) {
            return;
        }
        
        // Only process if airspace is visible
        if (getLayerManager().getVisibility('airspace-fill') !== 'visible') {
            // Even if airspace is not visible, we should clear existing popup and marker
            if (getPopup() || getPopupMarker()) {
                clearPopup();
                clearHighlight();
                clearMarker();
            }
            return;
        }

        // Clear existing popup and marker
        const existingPopup = getPopup();
        if (existingPopup) {
            clearPopup();
            clearHighlight();
            clearMarker();
            return;
        }

        // Clear existing marker
        clearMarker();
        
        // Query for features at click location
        const features = mapInstance.queryRenderedFeatures(e.point, { 
            layers: ['airspace-fill'] 
        });
        
        // Only create new marker and popup if we have airspace features at this location
        if (features && features.length > 0) {
            const newMarker = new maplibregl.Marker({ color: 'red' })
                .setLngLat(e.lngLat)
                .addTo(map);
            
            setPopupMarker(newMarker);
            setLastPopupLngLat(e.lngLat);

            try {
                // Ensure we have the complete data before creating the popup
                await fetchAirspaceData();
                createAirspacePopup();
            } catch (error) {
                console.error('Error creating airspace popup:', error);
                // Clean up if there's an error
                clearMarker();
                setLastPopupLngLat(null);
            }
        }
    });
}

/**
 * Initializes airspace data for the map
 * @returns {Promise<void>}
 */
export async function initializeAirspaceData() {
    try {
        const response = await fetch('airspace.geojson');
        if (!response.ok) {
            throw new Error(`Failed to fetch airspace data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        if (data && data.features) {
            // Import here to avoid circular dependencies
            const { createTypeCheckboxes } = await import('./sidebar.js');
            createTypeCheckboxes(data.features, getMap());
            
            // Ensure airspace layers are visible by default
            getLayerManager().setVisibility('airspace-fill', true);
            getLayerManager().setVisibility('airspace-outline', true);
        } else {
            console.warn('Airspace data is empty or missing features');
        }
    } catch (error) {
        console.error("Error loading airspace GeoJSON:", error);
        alert(`Failed to load airspace data: ${error.message}`);
    }

    // Fetch the complete airspace data
    await fetchAirspaceData();
} 