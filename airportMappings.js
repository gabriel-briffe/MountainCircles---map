/**
 * Airport type mappings and display styles
 * Matches MC-kmp AirportsData.kt / AirportColors.kt
 */

export const AIRPORT_TYPE_MAP = {
    0: "Airport (civil/military)",
    1: "Glider Site",
    2: "Airfield Civil",
    3: "International Airport",
    4: "Heliport Military",
    5: "Military Aerodrome",
    6: "Ultra Light Flying Site",
    7: "Heliport Civil",
    8: "Aerodrome Closed",
    9: "Airport resp. Airfield IFR",
    10: "Airfield Water",
    11: "Landing Strip",
    12: "Agricultural Landing Strip",
    13: "Altiport"
};

/** Numeric types excluded from import (MC-kmp AirportsStorage) */
export const SKIPPED_AIRPORT_TYPE_IDS = new Set([4, 7, 8, 10]);

/** Display order for airport type filters (importable types only) */
export const AIRPORT_TYPE_ORDER = Object.entries(AIRPORT_TYPE_MAP)
    .filter(([id]) => !SKIPPED_AIRPORT_TYPE_IDS.has(Number(id)))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, name]) => name);

/** String types excluded after normalization */
export const SKIPPED_AIRPORT_TYPES = new Set(
    [...SKIPPED_AIRPORT_TYPE_IDS].map((id) => AIRPORT_TYPE_MAP[id])
);

export const AIRPORT_PROPERTIES_TO_STRIP = [
    "magneticDeclination",
    "country",
    "createdAt",
    "updatedAt",
    "createdBy",
    "updatedBy",
    "services"
];

/** Solid colors by airport type (matches AIRPORT_COLOR_EXPRESSION) */
export const AIRPORT_TYPE_COLORS = {
    "International Airport": "#8B0000",
    "Military Aerodrome": "#8B0000",
    "Airport (civil/military)": "#2196F3",
    "Airport resp. Airfield IFR": "#2196F3",
    "Airfield Civil": "#2196F3",
    "Glider Site": "#2196F3",
    "Ultra Light Flying Site": "#FF9800",
    "Altiport": "#E91E63"
};

export function getAirportTypeColor(type) {
    return AIRPORT_TYPE_COLORS[type] || "#000000";
}

/** Traffic type mappings (MC-kmp AirportsStorage.kt) */
export const TRAFFIC_TYPE_MAP = {
    0: "VFR",
    1: "IFR"
};

/** Runway surface mappings (MC-kmp AirportsClickAreaLayer.kt) */
export const RUNWAY_SURFACE_MAP = {
    0: "Asphalt",
    1: "Concrete",
    2: "Grass",
    3: "Sand",
    4: "Water",
    5: "Bitume"
};

/** MapLibre match expression for circle color by airport type */
export const AIRPORT_COLOR_EXPRESSION = [
    "match",
    ["get", "type"],
    "International Airport", "#8B0000",
    "Military Aerodrome", "#8B0000",
    "Airport (civil/military)", "#2196F3",
    "Airport resp. Airfield IFR", "#2196F3",
    "Airfield Civil", "#2196F3",
    "Glider Site", "#2196F3",
    "Ultra Light Flying Site", "#FF9800",
    "Altiport", "#E91E63",
    "#000000"
];

/**
 * Normalizes a raw airport type value to a display string
 * @param {number|string|undefined} rawType
 * @returns {string|null}
 */
export function normalizeAirportType(rawType) {
    if (rawType === undefined || rawType === null) {
        return null;
    }

    if (typeof rawType === "number") {
        return AIRPORT_TYPE_MAP[rawType] ?? null;
    }

    if (typeof rawType === "string") {
        const trimmed = rawType.trim();
        if (!trimmed) {
            return null;
        }

        const numericType = Number(trimmed);
        if (!Number.isNaN(numericType) && AIRPORT_TYPE_MAP[numericType] !== undefined) {
            return AIRPORT_TYPE_MAP[numericType];
        }

        return trimmed;
    }

    return null;
}
