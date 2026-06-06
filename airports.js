/**
 * Airport popup and interaction for MountainCircles Map
 */

import {
    getAirportTypeColor,
    TRAFFIC_TYPE_MAP,
    RUNWAY_SURFACE_MAP
} from "./airportMappings.js";
import {
    getMap,
    getAirportsData,
    getLastPosition,
    getPopup,
    getAirportPopup,
    setAirportPopup,
    clearAirportPopup
} from "./state.js";
import { calculateDistance, getCurrentAltitude } from "./location.js";

const AIRPORT_QUERY_LAYERS = ["airports-click", "airports-circles"];

function formatDimensionPart(part) {
    if (!part || part.value == null) {
        return null;
    }

    const unit = part.unit === 2 ? "ft" : part.unit === 0 ? "m" : "";
    return `${part.value}${unit}`;
}

/**
 * Formats elevation for display (MC-kmp format: e.g. "67m msl")
 * @param {Object|number|string|null} elevation
 * @returns {string|null}
 */
/**
 * Returns airport elevation in meters for calculations
 * @param {Object|number|string|null} elevation
 * @returns {number|null}
 */
function getElevationMeters(elevation) {
    if (elevation == null) {
        return null;
    }

    if (typeof elevation === "number") {
        return elevation;
    }

    if (typeof elevation === "object" && elevation.value != null) {
        if (elevation.unit === 2) {
            return elevation.value * 0.3048;
        }

        return elevation.value;
    }

    return null;
}

function formatElevation(elevation) {
    if (elevation == null) {
        return null;
    }

    if (typeof elevation === "number") {
        return `${elevation}m msl`;
    }

    if (typeof elevation === "string") {
        return elevation;
    }

    if (typeof elevation === "object" && elevation.value != null) {
        const unit = elevation.unit === 2 ? "ft" : elevation.unit === 0 ? "m" : "?";
        const datum = elevation.referenceDatum === 1 ? "msl" : "?";
        return `${elevation.value}${unit} ${datum}`;
    }

    return null;
}

/**
 * Formats traffic types for display
 * @param {Array<number|string>|null} trafficType
 * @returns {string|null}
 */
function formatTrafficTypes(trafficType) {
    if (!Array.isArray(trafficType) || trafficType.length === 0) {
        return null;
    }

    const labels = trafficType.map((entry) => {
        if (typeof entry === "number") {
            return TRAFFIC_TYPE_MAP[entry] ?? String(entry);
        }

        if (typeof entry === "string" && entry.trim() !== "" && !Number.isNaN(Number(entry))) {
            return TRAFFIC_TYPE_MAP[Number(entry)] ?? entry;
        }

        return String(entry);
    });

    return labels.join(", ");
}

/**
 * Parses frequency entries from airport properties
 * @param {Array} frequencies
 * @returns {Array<{name: string, value: string, primary: boolean}>}
 */
function parseFrequencies(frequencies) {
    if (!Array.isArray(frequencies)) {
        return [];
    }

    return frequencies
        .map((frequency) => {
            if (!frequency || frequency.value == null) {
                return null;
            }

            return {
                name: frequency.name || "",
                value: String(frequency.value),
                primary: Boolean(frequency.primary)
            };
        })
        .filter(Boolean)
        .sort((a, b) => Number(b.primary) - Number(a.primary));
}

/**
 * Parses runway entries from airport properties
 * @param {Array} runways
 * @returns {Array<{designator: string, length: string, width: string, mainComposite: string}>}
 */
function parseRunways(runways) {
    if (!Array.isArray(runways)) {
        return [];
    }

    return runways
        .map((runway) => {
            if (!runway?.designator) {
                return null;
            }

            const length = formatDimensionPart(runway.dimension?.length);
            const width = formatDimensionPart(runway.dimension?.width);
            if (!length || !width) {
                return null;
            }

            let mainComposite = "";
            const surfaceValue = runway.surface?.mainComposite;
            if (typeof surfaceValue === "number") {
                mainComposite = RUNWAY_SURFACE_MAP[surfaceValue] || "Unknown";
            } else if (surfaceValue != null) {
                mainComposite = String(surfaceValue);
            }

            return {
                designator: runway.designator,
                length,
                width,
                mainComposite
            };
        })
        .filter(Boolean);
}

function appendInfoRow(parent, label, value) {
    const row = document.createElement("div");
    row.className = "airport-popup-row";

    const labelEl = document.createElement("span");
    labelEl.className = "airport-popup-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "airport-popup-value";
    valueEl.textContent = value;

    row.append(labelEl, valueEl);
    parent.appendChild(row);
}

function appendSectionTitle(parent, title) {
    const heading = document.createElement("h4");
    heading.className = "airport-popup-section-title";
    heading.textContent = title;
    parent.appendChild(heading);
}

function appendFrequencyRow(parent, frequency) {
    const row = document.createElement("div");
    row.className = "airport-popup-frequency-row";

    const marker = document.createElement("span");
    marker.className = "airport-popup-frequency-marker";
    marker.textContent = frequency.primary ? "★" : "";

    const name = document.createElement("span");
    name.className = "airport-popup-frequency-name";
    name.textContent = frequency.name;

    const value = document.createElement("span");
    value.className = "airport-popup-frequency-value";
    value.textContent = frequency.value;

    row.append(marker, name, value);
    parent.appendChild(row);
}

function appendRunwayRow(parent, runway) {
    const row = document.createElement("div");
    row.className = "airport-popup-runway-row";

    const designator = document.createElement("span");
    designator.className = "airport-popup-runway-designator";
    designator.textContent = runway.designator;

    const surface = document.createElement("span");
    surface.className = "airport-popup-runway-surface";
    surface.textContent = runway.mainComposite;

    const dimensions = document.createElement("span");
    dimensions.className = "airport-popup-runway-dimensions";
    dimensions.textContent = `${runway.length} × ${runway.width}`;

    row.append(designator, surface, dimensions);
    parent.appendChild(row);
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
    const content = document.createElement("div");
    content.className = "airport-popup-content";

    const colorBand = document.createElement("div");
    colorBand.className = "airport-popup-color-band";
    colorBand.style.backgroundColor = getAirportTypeColor(props.type);
    content.appendChild(colorBand);

    const header = document.createElement("div");
    header.className = "airport-popup-header";

    if (props.icaoCode && props.icaoCode !== "N/A") {
        const icao = document.createElement("span");
        icao.className = "airport-popup-icao";
        icao.textContent = props.icaoCode;
        header.appendChild(icao);
    }

    const name = document.createElement("strong");
    name.className = "airport-popup-name";
    name.textContent = props.name || "Unknown Airport";
    header.appendChild(name);
    content.appendChild(header);

    const details = document.createElement("div");
    details.className = "airport-popup-details";

    const distanceRow = document.createElement("div");
    distanceRow.className = "airport-popup-row airport-popup-distance-row";

    const distanceLabel = document.createElement("span");
    distanceLabel.className = "airport-popup-label";
    distanceLabel.textContent = "Distance";

    const distanceValue = document.createElement("span");
    distanceValue.className = "airport-popup-value airport-popup-distance-value";
    distanceValue.textContent = "—";

    distanceRow.append(distanceLabel, distanceValue);
    details.appendChild(distanceRow);

    const reqERow = document.createElement("div");
    reqERow.className = "airport-popup-row airport-popup-reqe-row";

    const reqELabel = document.createElement("span");
    reqELabel.className = "airport-popup-label";
    reqELabel.textContent = "reqE";

    const reqEValue = document.createElement("span");
    reqEValue.className = "airport-popup-value airport-popup-reqe-value";
    reqEValue.textContent = "—";

    reqERow.append(reqELabel, reqEValue);
    details.appendChild(reqERow);

    const elevationText = formatElevation(props.elevation);
    if (elevationText) {
        appendInfoRow(details, "Elevation", elevationText);
    }

    if (props.type) {
        appendInfoRow(details, "Type", props.type);
    }

    const trafficText = formatTrafficTypes(props.trafficType);
    if (trafficText) {
        appendInfoRow(details, "Traffic", trafficText);
    }

    const frequencies = parseFrequencies(props.frequencies);
    if (frequencies.length > 0) {
        appendSectionTitle(details, "Frequencies");
        frequencies.forEach((frequency) => appendFrequencyRow(details, frequency));
    }

    const runways = parseRunways(props.runways);
    if (runways.length > 0) {
        appendSectionTitle(details, "Runways");
        runways.forEach((runway) => appendRunwayRow(details, runway));
    }

    if (props.description) {
        appendSectionTitle(details, "Description");
        const description = document.createElement("div");
        description.className = "airport-popup-description";
        description.textContent = props.description;
        details.appendChild(description);
    }

    content.appendChild(details);
    return content;
}

/**
 * Positions the airport overlay above the airspace popup when both are open
 */
export function updateAirportPopupStyle() {
    const airportPopup = getAirportPopup();
    if (!airportPopup) {
        return;
    }

    const airspacePopup = getPopup();
    const isLandscape = window.innerWidth > window.innerHeight;

    airportPopup.style.right = "0px";
    airportPopup.style.width = "fit-content";
    airportPopup.style.maxWidth = isLandscape ? "50%" : "100%";
    airportPopup.style.height = "auto";
    airportPopup.style.transform = "";

    if (airspacePopup) {
        if (isLandscape) {
            airportPopup.style.top = "0px";
            airportPopup.style.bottom = "auto";
        } else {
            airportPopup.style.top = "auto";
            airportPopup.style.bottom = `${airspacePopup.offsetHeight + 4}px`;
        }
        return;
    }

    if (isLandscape) {
        airportPopup.style.top = "50%";
        airportPopup.style.bottom = "auto";
        airportPopup.style.transform = "translateY(-50%)";
    } else {
        airportPopup.style.top = "auto";
        airportPopup.style.bottom = "0px";
    }
}

/**
 * Shows the airport card overlay without disturbing the airspace popup
 * @param {Object} renderedFeature
 */
export function showAirportPopupOverlay(renderedFeature) {
    const feature = resolveAirportFeature(renderedFeature);
    if (!feature) {
        return;
    }

    clearAirportPopupOverlay();

    const popup = document.createElement("div");
    popup.className = "airport-popup";
    popup.style.display = "inline-flex";

    const airportElevationM = getElevationMeters(feature.properties?.elevation);
    if (airportElevationM != null) {
        popup.dataset.airportElevationM = String(airportElevationM);
    }

    if (feature.geometry?.coordinates?.length >= 2) {
        popup.dataset.airportLng = String(feature.geometry.coordinates[0]);
        popup.dataset.airportLat = String(feature.geometry.coordinates[1]);
    }

    popup.appendChild(buildAirportPopupContent(feature));

    setAirportPopup(popup);
    document.getElementById("map").appendChild(popup);
    updateAirportPopupStyle();
    updateAirportPopupDistance();
}

function applyReqEColor(element, reqE) {
    element.classList.remove("reqE-low", "reqE-mid", "reqE-high");

    if (reqE == null) {
        return;
    }

    if (reqE < 20) {
        element.classList.add("reqE-low");
    } else if (reqE <= 25) {
        element.classList.add("reqE-mid");
    } else {
        element.classList.add("reqE-high");
    }
}

/**
 * Updates distance and reqE in the open airport popup from the user's position
 */
export function updateAirportPopupDistance() {
    const popup = getAirportPopup();
    if (!popup) {
        return;
    }

    const distanceValue = popup.querySelector(".airport-popup-distance-value");
    const reqEValue = popup.querySelector(".airport-popup-reqe-value");
    if (!distanceValue || !reqEValue) {
        return;
    }

    const lastPosition = getLastPosition();
    const airportLng = Number(popup.dataset.airportLng);
    const airportLat = Number(popup.dataset.airportLat);

    if (!lastPosition?.coords || !Number.isFinite(airportLng) || !Number.isFinite(airportLat)) {
        distanceValue.textContent = "—";
        reqEValue.textContent = "—";
        applyReqEColor(reqEValue, null);
        return;
    }

    const userCoords = [lastPosition.coords.longitude, lastPosition.coords.latitude];
    const airportCoords = [airportLng, airportLat];
    const distanceKm = calculateDistance(userCoords, airportCoords) / 1000;

    distanceValue.textContent = `${distanceKm.toFixed(1)} km`;

    const airportElevationM = Number(popup.dataset.airportElevationM);
    const userAltitudeM = getCurrentAltitude();

    if (
        !Number.isFinite(airportElevationM) ||
        userAltitudeM == null ||
        !Number.isFinite(userAltitudeM)
    ) {
        reqEValue.textContent = "—";
        applyReqEColor(reqEValue, null);
        return;
    }

    const heightDiff = userAltitudeM - airportElevationM - 250;
    if (heightDiff <= 0) {
        reqEValue.textContent = "—";
        applyReqEColor(reqEValue, null);
        return;
    }

    const reqE = (distanceKm * 1000) / heightDiff;
    reqEValue.textContent = reqE.toFixed(1);
    applyReqEColor(reqEValue, reqE);
}

/**
 * Removes only the airport overlay card
 */
export function clearAirportPopupOverlay() {
    clearAirportPopup();
}

/**
 * @returns {boolean} Whether the airport popup is currently open
 */
export function isAirportPopupOpen() {
    return Boolean(getAirportPopup());
}

/**
 * Refreshes the airport popup after filter changes
 */
export function refreshAirportPopup() {
    const airportPopup = getAirportPopup();
    if (!airportPopup) {
        return;
    }

    const airportLng = Number(airportPopup.dataset.airportLng);
    const airportLat = Number(airportPopup.dataset.airportLat);

    if (!Number.isFinite(airportLng) || !Number.isFinite(airportLat)) {
        clearAirportPopupOverlay();
        return;
    }

    const map = getMap();
    const renderedFeatures = map.queryRenderedFeatures(map.project([airportLng, airportLat]), {
        layers: AIRPORT_QUERY_LAYERS
    });

    if (!renderedFeatures.length) {
        clearAirportPopupOverlay();
        return;
    }

    showAirportPopupOverlay(renderedFeatures[0]);
}

/**
 * Queries airport features at a map click point
 * @param {Object} mapInstance
 * @param {Object} point
 * @returns {Array}
 */
export function queryAirportFeaturesAtPoint(mapInstance, point) {
    if (!mapInstance.getLayer("airports-click") && !mapInstance.getLayer("airports-circles")) {
        return [];
    }

    return mapInstance.queryRenderedFeatures(point, {
        layers: AIRPORT_QUERY_LAYERS
    });
}

