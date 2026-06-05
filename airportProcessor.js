/**
 * Airport Processor Module
 * Downloads airport GeoJSON per country, transforms features, and caches the result
 */

import { BASE_PATH, CACHE_NAME } from "./config.js";
import { getAvailableCountries } from "./airspaceProcessor.js";
import {
    normalizeAirportType,
    SKIPPED_AIRPORT_TYPE_IDS,
    SKIPPED_AIRPORT_TYPES,
    AIRPORT_PROPERTIES_TO_STRIP
} from "./airportMappings.js";
import { getAirportsData, setAirportsData } from "./state.js";

const GCS_BASE_URL = "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f";
const PROXY_URL = "https://edl-proxy.gabriel-briffe.workers.dev/?url=";
const AIRPORTS_CACHE_PATH = `${BASE_PATH}/airports.geojson`;

/**
 * @typedef {Object} ProgressCallback
 * @property {Function} onProgress
 * @property {Function} onStatus
 */

function getCountryName(countryCode) {
    const country = getAvailableCountries().find((entry) => entry.code === countryCode);
    return country?.name ?? countryCode.toUpperCase();
}

function getAirportUrl(countryCode) {
    return `${GCS_BASE_URL}/${countryCode}_apt.geojson`;
}

/**
 * Transforms a raw airport feature to the display format used by MC-kmp
 * @param {Object} feature
 * @param {string} countryCode
 * @returns {Object|null}
 */
export function transformAirportFeature(feature, countryCode) {
    if (!feature?.geometry || feature.geometry.type !== "Point") {
        return null;
    }

    const properties = { ...(feature.properties || {}) };
    const rawType = properties.type;
    const numericType = typeof rawType === "number"
        ? rawType
        : (typeof rawType === "string" && rawType.trim() !== "" && !Number.isNaN(Number(rawType))
            ? Number(rawType)
            : null);

    if (numericType !== null && SKIPPED_AIRPORT_TYPE_IDS.has(numericType)) {
        return null;
    }

    const type = normalizeAirportType(rawType);
    if (!type || SKIPPED_AIRPORT_TYPES.has(type)) {
        return null;
    }

    AIRPORT_PROPERTIES_TO_STRIP.forEach((key) => {
        delete properties[key];
    });

    properties.type = type;

    if (!properties._id) {
        properties._id = properties.icaoCode || feature.id || null;
    }

    properties.countryCode = countryCode;

    return {
        type: "Feature",
        geometry: feature.geometry,
        properties
    };
}

/**
 * Downloads and transforms airport data for a specific country
 * @param {string} countryCode
 * @param {Function} onStatus
 * @returns {Promise<Object>}
 */
async function downloadCountryAirports(countryCode, onStatus = () => {}) {
    const countryName = getCountryName(countryCode);
    const sourceUrl = getAirportUrl(countryCode);

    console.log(`[AirportProcessor] Downloading ${countryName} from ${sourceUrl}`);

    const proxyUrl = `${PROXY_URL}${encodeURIComponent(sourceUrl)}`;
    const response = await fetch(proxyUrl);

    if (!response.ok) {
        throw new Error(`Failed to download ${countryName}: ${response.status} ${response.statusText}`);
    }

    const geoJSON = await response.json();

    if (!geoJSON || !Array.isArray(geoJSON.features)) {
        throw new Error(`Invalid GeoJSON for ${countryName}`);
    }

    onStatus(`Processing ${countryName} airports...`);

    const features = geoJSON.features
        .map((feature) => transformAirportFeature(feature, countryCode))
        .filter(Boolean);

    console.log(`[AirportProcessor] Processed ${features.length} airports from ${countryName}`);

    return {
        type: "FeatureCollection",
        features
    };
}

/**
 * Downloads and processes airport data for selected countries
 * @param {Array<string>} selectedCountries
 * @param {ProgressCallback} callbacks
 * @returns {Promise<Object>}
 */
export async function importSelectedAirports(selectedCountries, callbacks = {}) {
    console.log("[AirportProcessor] Starting import for countries:", selectedCountries);

    if (selectedCountries.length === 0) {
        throw new Error("No countries selected for airport import");
    }

    const { onProgress = () => {}, onStatus = () => {} } = callbacks;
    const combinedGeoJSON = {
        type: "FeatureCollection",
        features: []
    };

    let processedCount = 0;
    const totalCount = selectedCountries.length;

    onStatus("Starting airport import...");
    onProgress(0, totalCount, "Initializing airports...");

    for (const countryCode of selectedCountries) {
        const countryName = getCountryName(countryCode);

        try {
            onStatus(`Downloading ${countryName} airports...`);
            const countryData = await downloadCountryAirports(countryCode, onStatus);

            if (countryData.features.length > 0) {
                combinedGeoJSON.features.push(...countryData.features);
                console.log(`[AirportProcessor] Added ${countryData.features.length} airports from ${countryName}`);
            } else {
                console.warn(`[AirportProcessor] No airports found for ${countryName}`);
            }
        } catch (error) {
            console.error(`[AirportProcessor] Error processing ${countryCode}:`, error);
            onStatus(`Warning: Failed to process ${countryName} airports: ${error.message}`);
        }

        processedCount++;
        onProgress(processedCount, totalCount, `Processed ${countryName} airports`);
    }

    onStatus("Saving airports to cache...");
    await saveToCache(combinedGeoJSON);

    onStatus(`Imported ${combinedGeoJSON.features.length} airports from ${processedCount} countries`);
    onProgress(totalCount, totalCount, "Airport import complete");

    console.log(`[AirportProcessor] Import complete: ${combinedGeoJSON.features.length} total airports`);

    return combinedGeoJSON;
}

/**
 * Saves combined airport GeoJSON to cache
 * @param {Object} geoJSON
 * @returns {Promise<void>}
 */
async function saveToCache(geoJSON) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = new Response(JSON.stringify(geoJSON), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache"
            }
        });

        await cache.put(AIRPORTS_CACHE_PATH, response);
        setAirportsData(geoJSON);

        console.log(`[AirportProcessor] Saved ${geoJSON.features.length} airports to cache as ${AIRPORTS_CACHE_PATH}`);
    } catch (error) {
        console.error("[AirportProcessor] Error saving to cache:", error);
        throw new Error(`Failed to save airport data to cache: ${error.message}`);
    }
}

/**
 * Loads cached airport data
 * @returns {Promise<Object>}
 */
export async function loadCachedAirports() {
    if (getAirportsData()) {
        return getAirportsData();
    }

    try {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(AIRPORTS_CACHE_PATH);

        let data;
        if (cachedResponse) {
            console.log("[AirportProcessor] Found cached airport data");
            data = await cachedResponse.json();
        } else {
            console.log("[AirportProcessor] No cached airport data found, returning empty GeoJSON");
            data = {
                type: "FeatureCollection",
                features: []
            };
        }

        setAirportsData(data);
        return data;
    } catch (error) {
        console.error("[AirportProcessor] Error loading airport data from cache:", error);

        const emptyData = {
            type: "FeatureCollection",
            features: []
        };

        setAirportsData(emptyData);
        return emptyData;
    }
}

/**
 * Clears cached airport data
 * @returns {Promise<boolean>}
 */
export async function clearAirportsCache() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const deleted = await cache.delete(AIRPORTS_CACHE_PATH);

        if (deleted) {
            console.log("[AirportProcessor] Airport cache cleared successfully");
        } else {
            console.log("[AirportProcessor] No airport cache found to clear");
        }

        setAirportsData(null);
        return true;
    } catch (error) {
        console.error("[AirportProcessor] Error clearing airport cache:", error);
        throw new Error(`Failed to clear airport cache: ${error.message}`);
    }
}

/**
 * Checks if airport data exists in cache
 * @returns {Promise<boolean>}
 */
export async function hasAirportsCache() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match(AIRPORTS_CACHE_PATH);
        return !!response;
    } catch (error) {
        console.error("[AirportProcessor] Error checking airport cache:", error);
        return false;
    }
}
