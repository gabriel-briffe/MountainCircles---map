// Map functionality for MountainCircles Map
import {
    getMap,
    getLayerManager,
    getPopupMarker,
    setPopupMarker,
    setLastPopupLngLat,
    getPopup,
    clearPopup,
    getCurrentConfig,
    getLastPopupLngLat,
    setAirspaceVisible
} from "./state.js";

import {
    fetchAirspaceData,
    createAirspacePopup,
    clearHighlight
} from "./airspace.js";

import {
    queryAirportFeaturesAtPoint,
    showAirportPopupAtClick
} from "./airports.js";

import { pointClickedFlag } from "./layers.js";

/**
 * Removes the popup marker if it exists
 */
export function clearMarker() {
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
        
        // Don't show airspace popup if a point was just clicked
        if (pointClickedFlag) {
            return;
        }
        
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

        const airportFeatures = queryAirportFeaturesAtPoint(mapInstance, e.point);
        if (airportFeatures.length > 0) {
            showAirportPopupAtClick(mapInstance, e.lngLat, airportFeatures[0]);
            return;
        }
        
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
        // We'll use the fetchAirspaceData function which now uses the proxy
        const data = await fetchAirspaceData();
        
        if (data && data.features) {
            // Update the map source with the fetched data
            const map = getMap();
            if (map && map.getSource('airspace')) {
                map.getSource('airspace').setData(data);
            }
            
            // Import here to avoid circular dependencies
            const { createTypeCheckboxes } = await import('./sidebar.js');
            createTypeCheckboxes(data.features, map);
            
            // No need to force airspace to be visible here
            // This will be handled by init.js using the saved state
        } else {
            console.warn('Airspace data is empty or missing features');
        }
    } catch (error) {
        console.error("Error loading airspace GeoJSON:", error);
        alert(`Failed to load airspace data: ${error.message}`);
    }
} 