/**
 * Layer styles for MountainCircles Map
 * Contains style definitions for all map layers
 */

/**
 * Polygon layer styles
 */
export const polygonLayerStyle = {
    id: 'polygons-layer',
    type: 'fill',
    source: 'polygons',
    paint: {
        'fill-color': [
            "match",
            ["get", "color_id"],
            0, "#0000FF",
            1, "#FF00FF",
            2, "#FFFF00",
            3, "#00FFFF",
            4, "#00FF00",
            5, "#FF0000",
            6, "#FFA500",
            "#000000"
        ],
        'fill-opacity': 0.1
    }
};

/**
 * Line String layer styles
 */
export const lineStringLayerStyle = {
    id: 'linestrings-layer',
    type: 'line',
    source: 'geojson-data',
    minzoom: 7,
    filter: ['==', '$type', 'LineString'],
    paint: {
        'line-color': '#000',
        'line-width': ['step', ['zoom'], 1, 10, 2]
    }
};

export const lineStringLabelsLayerStyle = {
    id: 'linestrings-labels',
    type: 'symbol',
    source: 'geojson-data',
    minzoom: 9,
    filter: ['==', '$type', 'LineString'],
    layout: {
        'text-field': '{ELEV}',
        'symbol-placement': 'line',
        'text-rotation-alignment': 'auto',
        'text-keep-upright': true,
        'text-size': 14, // This will be updated dynamically with getBaseTextSize()
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-offset': [0, 0],
        'symbol-spacing': 250
    },
    paint: {
        'text-color': '#000',
        'text-halo-color': '#fff',
        'text-halo-width': 2
    }
};

/**
 * Point layer styles
 */
export const pointLayerStyle = {
    id: 'points-layer',
    type: 'circle',
    source: 'geojson-data',
    minzoom: 7,
    filter: ['==', '$type', 'Point'],
    paint: {
        'circle-radius': 5,
        'circle-color': '#ff0000',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
    }
};

export const pointLayerClickableStyle = {
    id: 'points-layer-clickable',
    type: 'circle',
    source: 'geojson-data',
    minzoom: 7,
    filter: ['==', '$type', 'Point'],
    paint: {
        'circle-radius': 20,
        'circle-color': '#000000',
        'circle-opacity': 0
    }
};

export const pointLabelsLayerStyle = {
    id: 'points-labels',
    type: 'symbol',
    source: 'geojson-data',
    minzoom: 8,
    filter: ['==', '$type', 'Point'],
    layout: {
        'text-field': '{name}',
        'text-size': 15, // This will be updated dynamically with getBaseTextSize() + 5
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-offset': [0.8, 0.8],
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
        'text-radial-offset': 0.8,
        'symbol-spacing': 20
    },
    paint: {
        'text-color': '#000',
        'text-halo-color': '#fff',
        'text-halo-width': 2
    }
};

/**
 * Peaks and Passes layer styles
 */
export const peaksSymbolsLayerStyle = {
    id: 'peaks-symbols',
    type: 'symbol',
    source: 'peaks',
    minzoom: 10,
    layout: {
        'icon-image': 'peak-triangle',
        'icon-size': 1,
        'icon-anchor': 'bottom',
        'text-field': ['get', 'namele'],
        'text-size': 14, // This will be updated dynamically with getBaseTextSize()
        'text-anchor': 'top',
        'text-offset': [0, 0.5],
        'icon-allow-overlap': false,
        'icon-ignore-placement': false,
        'icon-optional': true,
        'icon-padding': 2,
        'symbol-spacing': 250,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
        'text-padding': 2,
        'text-field': [
            'step',
            ['zoom'],
            '',
            11, ['get', 'namele']
        ]
    },
    paint: {
        'text-color': '#654321', 
        'text-halo-color': '#fff',
        'text-halo-width': 2
    }
};

export const passesSymbolsLayerStyle = {
    id: 'passes-symbols',
    type: 'symbol',
    source: 'passes',
    minzoom: 10,
    layout: {
        'icon-image': 'pass-triangle',
        'icon-size': 1,
        'icon-anchor': 'top',
        'text-field': ['get', 'name'],
        'text-size': 14, // This will be updated dynamically with getBaseTextSize()
        'text-anchor': 'bottom',
        'text-offset': [0, -0.5],
        'icon-allow-overlap': false,
        'icon-ignore-placement': false,
        'icon-optional': true,
        'icon-padding': 2,
        'symbol-spacing': 250,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
        'text-padding': 2,
        'text-field': [
            'step',
            ['zoom'],
            '',
            11, ['get', 'name']
        ]
    },
    paint: {
        'text-color': '#006400',
        'text-halo-color': '#fff',
        'text-halo-width': 2
    }
};

/**
 * Location Marker styles
 */
export const locationMarkerStyle = {
    id: 'location-marker-circle',
    type: 'circle',
    source: 'location-marker',
    paint: {
        'circle-radius': 8,
        'circle-color': '#0066FF',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFFFFF'
    }
};

/**
 * Highlight Layer styles
 */
export const highlightAirspaceStyle = {
    id: 'highlight-airspace',
    type: 'fill',
    source: 'highlight-airspace-source',
    paint: {
        'fill-color': 'rgba(64,224,208,0.5)',
        'fill-outline-color': 'rgba(64,224,208,1)'
    }
};

/**
 * Dynamic Layer styles
 * These are used for dynamically created layers when clicking on points
 */
export const dynamicLineLayerStyle = {
    type: 'line',
    paint: {
        'line-color': '#000',
        'line-width': ['step', ['zoom'], 1, 10, 2]
    }
};

export const dynamicLabelLayerStyle = {
    type: 'symbol',
    layout: {
        'text-field': '{ELEV}',
        'symbol-placement': 'line',
        'text-rotation-alignment': 'auto',
        'text-keep-upright': true,
        'text-size': 14, // This will be updated dynamically with getBaseTextSize()
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-offset': [0, 0],
        'symbol-spacing': 250
    },
    paint: {
        'text-color': '#000',
        'text-halo-color': '#fff',
        'text-halo-width': 2
    }
};

/**
 * IGC Track Layer styles
 */
export const IGC_STYLES = {
    // Base styles
    track: {
        line: {
            type: 'line',
            paint: {
                'line-color': '#0000FF',
                'line-width': 2
            }
        },
        points: {
            type: 'circle',
            filter: ['==', '$type', 'Point'],
            paint: {
                'circle-radius': 4,
                'circle-color': '#0000FF',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#FFFFFF'
            }
        },
        labels: {
            type: 'symbol',
            filter: ['==', '$type', 'Point'],
            layout: {
                'text-field': '{altitude}',
                'text-offset': [0, -0.5],
                'text-allow-overlap': false,
                'text-ignore-placement': false
            },
            paint: {
                'text-color': '#0000FF',
                'text-halo-color': '#fff',
                'text-halo-width': 2
            }
        },
        altitudePoints: {
            type: 'circle',
            filter: ['==', '$type', 'Point'],
            paint: {
                'circle-radius': 3,
                'circle-color': '#0000FF',
                'circle-opacity': 0
            }
        }
    },
    
    // Style creators
    createTrackStyle: (sourceId, layerId) => ({
        ...IGC_STYLES.track.line,
        id: layerId,
        source: sourceId
    }),
    
    createLabelsStyle: (sourceId, layerId, textSize) => ({
        ...IGC_STYLES.track.labels,
        id: layerId,
        source: sourceId,
        layout: {
            ...IGC_STYLES.track.labels.layout,
            'text-size': textSize
        },
        minzoom: 9
    }),
    
    createAltitudePointsStyle: (sourceId, layerId) => ({
        ...IGC_STYLES.track.altitudePoints,
        id: layerId,
        source: sourceId
    })
};

// Keep these for backward compatibility, but they'll be deprecated
export const igcTrackLayerStyle = IGC_STYLES.track.line;
export const igcTrackPointsLayerStyle = IGC_STYLES.track.points;
export const igcTrackLabelsLayerStyle = IGC_STYLES.track.labels;

/**
 * Creates a dynamic IGC track layer style with the given source and ID
 * @param {string} sourceId - The source ID for the layer
 * @param {string} layerId - The layer ID
 * @returns {Object} The complete layer style
 */
export function createDynamicIGCTrackStyle(sourceId, layerId) {
    return IGC_STYLES.createTrackStyle(sourceId, layerId);
}

/**
 * Creates a dynamic IGC track labels style with the given source, ID, and text size
 * @param {string} sourceId - The source ID for the layer
 * @param {string} layerId - The layer ID
 * @param {number} textSize - The text size to use
 * @returns {Object} The complete layer style
 */
export function createDynamicIGCTrackLabelsStyle(sourceId, layerId, textSize) {
    return IGC_STYLES.createLabelsStyle(sourceId, layerId, textSize);
} 