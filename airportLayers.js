/**
 * Airport map layers for MountainCircles Map
 */

import { AIRPORT_COLOR_EXPRESSION } from "./airportMappings.js";
import { loadCachedAirports } from "./airportProcessor.js";
import { getMap, getLayerManager, getBaseTextSize, setAirportsData } from "./state.js";

export const airportsCirclesLayerStyle = {
    id: "airports-circles",
    type: "circle",
    source: "airports",
    minzoom: 6,
    paint: {
        "circle-radius": 6,
        "circle-color": AIRPORT_COLOR_EXPRESSION,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#FFFFFF"
    }
};

export const airportsLabelsLayerStyle = {
    id: "airports-labels",
    type: "symbol",
    source: "airports",
    minzoom: 8,
    layout: {
        "text-field": ["get", "name"],
        "text-size": 14,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-allow-overlap": false,
        "text-ignore-placement": false
    },
    paint: {
        "text-color": "#000000",
        "text-halo-color": "#FFFFFF",
        "text-halo-width": 2
    }
};

/**
 * Adds airport source and layers to the map
 */
export function initializeAirportLayers() {
    const layerManager = getLayerManager();

    layerManager.addOrUpdateSource("airports", {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: []
        }
    });

    const labelsStyle = {
        ...airportsLabelsLayerStyle,
        layout: {
            ...airportsLabelsLayerStyle.layout,
            "text-size": getBaseTextSize()
        }
    };

    layerManager.addLayerIfNotExists("airports-circles", airportsCirclesLayerStyle);
    layerManager.addLayerIfNotExists("airports-labels", labelsStyle);
}

/**
 * Loads cached airport data and updates the map source
 * @returns {Promise<void>}
 */
export async function initializeAirportsData() {
    initializeAirportLayers();

    try {
        const data = await loadCachedAirports();
        const map = getMap();

        if (map && map.getSource("airports")) {
            map.getSource("airports").setData(data);
        }

        setAirportsData(data);

        if (data.features.length > 0) {
            console.log(`[AirportLayers] Loaded ${data.features.length} airports`);
        } else {
            console.log("[AirportLayers] No cached airports to display");
        }
    } catch (error) {
        console.error("[AirportLayers] Error loading airport data:", error);
    }
}
