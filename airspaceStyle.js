import { COLOR_MAPPING } from "./mappings.js";
import { BASE_PATH } from "./config.js";


const style = {
    "version": 8,
    "name": "Custom Map",
    "glyphs": "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    "sources": {
        "custom-tiles": {
            "type": "raster",
            "tiles": [
                `${BASE_PATH}/tiles/{z}/{x}/{y}.png`  // Relative path to your tiles folder on GitHub Pages
            ],
            "tileSize": 256,
            "maxzoom": 12,  // This ensures that even if you zoom past level 12, the map uses these tiles.
            "attribution": "Map data © OpenStreetMap contributors + Alos topographic data"
        },
        "airspace": {
            "type": "geojson",
            "data": `${BASE_PATH}/airspace.geojson`,
            // "generateId": true
        }
    },
    "layers": [
        {
            "id": "custom-tiles",
            "type": "raster",
            "source": "custom-tiles",
            "minzoom": 0   // Remove maxzoom here so the layer remains visible at higher zooms
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
                    "FIS_SECTOR", COLOR_MAPPING["FIS_SECTOR"],
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