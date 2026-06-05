/**
 * Airport popup and interaction for MountainCircles Map
 */

import { getAirportTypeColor } from "./airportMappings.js";
import {
    getMap,
    getAirportsData,
    getLastPopupLngLat,
    getPopup,
    getPopupMarker,
    setPopup,
    setPopupMarker,
    setLastPopupLngLat,
    clearPopup
} from "./state.js";
import { clearHighlight, updatePopupStyle } from "./airspace.js";

const AIRPORT_QUERY_LAYERS = ['airports-click', 'airports-circles'];

/**
 * Formats elevation for display
 * @param {Object|number|null} elevation
 * @returns {string|null}
 */
function formatElevation(elevation) {
    if (elevation == null) {
        return null;
    }

    if (typeof elevation === 'number') {
        return `${elevation} m`;
    }

    if (typeof elevation === 'object' && elevation.value != null) {
        return `${elevation.value} m`;
    }

    return null;
}

/**
 * Formats the primary radio frequency for display
 * @param {Array} frequencies
 * @returns {string|null}
 */
function formatPrimaryFrequency(frequencies) {
    if (!Array.isArray(frequencies) || frequencies.length === 0) {
        return null;
    }

    const primary = frequencies.find((entry) => entry.primary) || frequencies[0];
    if (!primary?.value) {
        return null;
    }

    const label = primary.name ? `${primary.name} ` : '';
    return `${label}${primary.value}`.trim();
}

/**
 * Finds the full airport feature from cached data
 * @param {Object} renderedFeature
 * @returns {Object|null}
 */
function resolveAirportFeature(renderedFeature) {
    const props = renderedFeature?.properties || {};
    const airportData = getAirportsData();

    if (!airportData?.features?.length) {
        return renderedFeature;
    }

    if (props._id) {
        const match = airportData.features.find((feature) => feature.properties?._id === props._id);
        if (match) {
            return match;
        }
    }

    if (props.icaoCode) {
        const match = airportData.features.find((feature) => feature.properties?.icaoCode === props.icaoCode);
        if (match) {
            return match;
        }
    }

    return renderedFeature;
}

/**
 * Builds popup content for an airport feature
 * @param {Object} feature
 * @returns {HTMLElement}
 */
function buildAirportPopupContent(feature) {
    const props = feature.properties || {};
    const content = document.createElement('div');
    content.className = 'airport-popup-content';

    const header = document.createElement('div');
    header.className = 'airport-popup-header';
    header.innerHTML = `<strong>${props.name || 'Unknown Airport'}</strong>`;
    content.appendChild(header);

    const details = document.createElement('div');
    details.className = 'airport-popup-details';

    if (props.icaoCode) {
        const icaoRow = document.createElement('div');
        icaoRow.className = 'airport-popup-row';
        icaoRow.innerHTML = `<span class="airport-popup-label">ICAO</span><span>${props.icaoCode}</span>`;
        details.appendChild(icaoRow);
    }

    if (props.type) {
        const typeRow = document.createElement('div');
        typeRow.className = 'airport-popup-row';
        typeRow.innerHTML = `<span class="airport-popup-label">Type</span><span>${props.type}</span>`;
        details.appendChild(typeRow);
    }

    const elevationText = formatElevation(props.elevation);
    if (elevationText) {
        const elevationRow = document.createElement('div');
        elevationRow.className = 'airport-popup-row';
        elevationRow.innerHTML = `<span class="airport-popup-label">Elevation</span><span>${elevationText}</span>`;
        details.appendChild(elevationRow);
    }

    const frequencyText = formatPrimaryFrequency(props.frequencies);
    if (frequencyText) {
        const frequencyRow = document.createElement('div');
        frequencyRow.className = 'airport-popup-row';
        frequencyRow.style.color = 'darkgreen';
        frequencyRow.innerHTML = `<span class="airport-popup-label">Frequency</span><span>${frequencyText}</span>`;
        details.appendChild(frequencyRow);
    }

    content.appendChild(details);

    const colorBand = document.createElement('div');
    colorBand.className = 'airport-popup-color-band';
    colorBand.style.backgroundColor = getAirportTypeColor(props.type);
    content.appendChild(colorBand);

    return content;
}

/**
 * Creates an airport popup at the current marker location
 */
export function createAirportPopup() {
    const map = getMap();
    const lngLat = getLastPopupLngLat();

    if (!map || !lngLat) {
        console.warn('[Airports] Cannot create popup: missing map or location');
        return;
    }

    const renderedFeatures = map.queryRenderedFeatures(map.project(lngLat), {
        layers: AIRPORT_QUERY_LAYERS
    });

    if (!renderedFeatures.length) {
        closeAirportPopup();
        return;
    }

    const feature = resolveAirportFeature(renderedFeatures[0]);

    clearPopup();
    clearHighlight();

    const popup = document.createElement('div');
    popup.className = 'airport-popup';
    popup.style.display = 'inline-flex';
    popup.appendChild(buildAirportPopupContent(feature));

    setPopup(popup);
    document.getElementById('map').appendChild(popup);
    updatePopupStyle();
}

/**
 * Closes the airport popup and marker
 */
function clearAirportMarker() {
    const marker = getPopupMarker();
    if (marker) {
        marker.remove();
        setPopupMarker(null);
    }
}

export function closeAirportPopup() {
    clearPopup();
    clearAirportMarker();
    setLastPopupLngLat(null);
}

/**
 * Refreshes the airport popup after filter changes
 */
export function refreshAirportPopup() {
    const lngLat = getLastPopupLngLat();
    if (!lngLat || !getPopup()) {
        return;
    }

    const map = getMap();
    const renderedFeatures = map.queryRenderedFeatures(map.project(lngLat), {
        layers: AIRPORT_QUERY_LAYERS
    });

    if (!renderedFeatures.length) {
        closeAirportPopup();
        return;
    }

    createAirportPopup();
}

/**
 * Queries airport features at a map click point
 * @param {Object} mapInstance
 * @param {Object} point
 * @returns {Array}
 */
export function queryAirportFeaturesAtPoint(mapInstance, point) {
    if (!mapInstance.getLayer('airports-click') && !mapInstance.getLayer('airports-circles')) {
        return [];
    }

    return mapInstance.queryRenderedFeatures(point, {
        layers: AIRPORT_QUERY_LAYERS
    });
}

/**
 * Shows an airport popup for a clicked feature
 * @param {Object} mapInstance
 * @param {Object} lngLat
 * @param {Object} renderedFeature
 */
export function showAirportPopupAtClick(mapInstance, lngLat, renderedFeature) {
    clearPopup();
    clearHighlight();
    clearAirportMarker();

    const marker = new maplibregl.Marker({ color: '#2196F3' })
        .setLngLat(lngLat)
        .addTo(mapInstance);

    setPopupMarker(marker);
    setLastPopupLngLat(lngLat);

    resolveAirportFeature(renderedFeature);
    createAirportPopup();
}
