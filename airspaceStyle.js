import { COLOR_MAPPING } from "./mappings.js";
import { MAPTERHORN_TILE_SETTINGS } from "./config.js";


const style = {
    "version": 8,
    "name": "Custom Map",
    "glyphs": "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    "sources": {
        "unified-tiles": {
            "type": "raster",
            "tiles": [
                "custom://tiles/{z}/{x}/{y}"
            ],
            "tileSize": 256,
            "maxzoom": 19,
            "attribution": "Map data © OpenStreetMap contributors"
        },
        "mapterhorn-terrain": {
            "type": "raster-dem",
            "tiles": [
                MAPTERHORN_TILE_SETTINGS.protocolTemplate
            ],
            "encoding": MAPTERHORN_TILE_SETTINGS.encoding,
            "tileSize": MAPTERHORN_TILE_SETTINGS.tileSize,
            "maxzoom": MAPTERHORN_TILE_SETTINGS.maxZoom,
            "attribution": MAPTERHORN_TILE_SETTINGS.attribution
        },
        "airspace": {
            "type": "geojson",
            "data": {
                "type": "FeatureCollection",
                "features": []
            }
        }
    },
    "layers": [
        {
            "id": "unified-tiles",
            "type": "raster",
            "source": "unified-tiles",
            "minzoom": 0,
            "maxzoom": 19
        },
        {
            "id": "mapterhorn-hillshade",
            "type": "hillshade",
            "source": "mapterhorn-terrain",
            "paint": {
                "hillshade-exaggeration": 0.4,
                "hillshade-shadow-color": "#473B24",
                "hillshade-highlight-color": "#FFFFFF",
                "hillshade-illumination-direction": 310
            }
        },
        {
            "id": "airspace-fill",
            "type": "fill",
            "source": "airspace",
            "paint": {
                "fill-color": "rgba(0, 0, 0, 0)",  // Transparent fill
                "fill-opacity": 0  // No opacity
            }
        },
        {
            "id": "airspace-outline",
            "type": "line",
            "source": "airspace",
            "layout": {
                "line-sort-key": ["get", "upperLimitMeters"]
            },
            paint: {
                "line-color": [
                    "match",
                    ["get", "type"],
                    // ICAO classes
                    "A", COLOR_MAPPING["A"],
                    "C", COLOR_MAPPING["C"],
                    "D", COLOR_MAPPING["D"],
                    "E", COLOR_MAPPING["E"],
                    "G", COLOR_MAPPING["G"],
                    // Special areas
                    "PROHIBITED", COLOR_MAPPING["PROHIBITED"],
                    "DANGER", COLOR_MAPPING["DANGER"],
                    "RESTRICTED", COLOR_MAPPING["RESTRICTED"],
                    "FIR", COLOR_MAPPING["FIR"],
                    "FIS", COLOR_MAPPING["FIS"],
                    "OVERFLIGHT_RESTRICTION", COLOR_MAPPING["OVERFLIGHT_RESTRICTION"],
                    "TRA", COLOR_MAPPING["TRA"],
                    "UNCLASSIFIED", COLOR_MAPPING["UNCLASSIFIED"],
                    // Additional types
                    "ACTIVITY", COLOR_MAPPING["ACTIVITY"],
                    "GLIDING_SECTOR", COLOR_MAPPING["GLIDING_SECTOR"],
                    "MTA", COLOR_MAPPING["MTA"],
                    "TMZ", COLOR_MAPPING["TMZ"],
                    // Default
                    COLOR_MAPPING["other"]
                ],
                "line-width": 2  // Consistent line width
            }
        }
    ]
};

export default style; 