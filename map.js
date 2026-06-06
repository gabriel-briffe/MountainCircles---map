// Map functionality for MountainCircles Map
import {
    getMap,
    getLayerManager,
    getPopupMarker,
    setPopupMarker,
    setLastPopupLngLat,
    getPopup,
    getAirportPopup,
    clearPopup,
    clearAirportPopup
} from "./state.js";

import {
    fetchAirspaceData,
    createAirspacePopup,
    clearHighlight
} from "./airspace.js";

import {
    queryAirportFeaturesAtPoint,
    showAirportPopupOverlay,
    clearAirportPopupOverlay
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

function clearAllPopups() {
    clearAirportPopupOverlay();
    clearPopup();
    clearHighlight();
    clearMarker();
    setLastPopupLngLat(null);
}

function hasOpenPopups() {
    return Boolean(getPopup() || getAirportPopup() || getPopupMarker());
}

/**
 * Sets up the airspace popup click handler on the map
 * @param {Object} mapInstance - The map instance
 */
export function setupAirspacePopupHandler(mapInstance) {
    mapInstance.on('click', async function(e) {
        const map = getMap();

        if (pointClickedFlag) {
            return;
        }

        if (closeSidebarIfOpen()) {
            return;
        }

        if (getLayerManager().getVisibility('airspace-fill') !== 'visible') {
            if (hasOpenPopups()) {
                clearAllPopups();
            }
            return;
        }

        if (hasOpenPopups()) {
            clearAllPopups();
            return;
        }

        const airspaceFeatures = mapInstance.queryRenderedFeatures(e.point, {
            layers: ['airspace-fill']
        });
        const airportFeatures = queryAirportFeaturesAtPoint(mapInstance, e.point);

        const hasAirspace = airspaceFeatures.length > 0;
        const hasAirport = airportFeatures.length > 0;

        if (!hasAirspace && !hasAirport) {
            return;
        }

        const newMarker = new maplibregl.Marker({ color: 'red' })
            .setLngLat(e.lngLat)
            .addTo(map);

        setPopupMarker(newMarker);
        setLastPopupLngLat(e.lngLat);

        if (hasAirspace) {
            try {
                await fetchAirspaceData();
                createAirspacePopup();
            } catch (error) {
                console.error('Error creating airspace popup:', error);
                clearAllPopups();
                return;
            }
        }

        if (hasAirport) {
            showAirportPopupOverlay(airportFeatures[0]);
        }
    });
}

/**
 * Initializes airspace data for the map
 * @returns {Promise<void>}
 */
export async function initializeAirspaceData() {
    try {
        const data = await fetchAirspaceData();

        if (data && data.features) {
            const map = getMap();
            if (map && map.getSource('airspace')) {
                map.getSource('airspace').setData(data);
            }

            const { createTypeCheckboxes } = await import('./sidebar.js');
            createTypeCheckboxes(data.features, map);
        } else {
            console.warn('Airspace data is empty or missing features');
        }
    } catch (error) {
        console.error("Error loading airspace GeoJSON:", error);
        alert(`Failed to load airspace data: ${error.message}`);
    }
}
