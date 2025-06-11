/**
 * Airspace Processor Module
 * Handles downloading OpenAir files, processing them to GeoJSON, and caching the result
 */

import { BASE_PATH, CACHE_NAME } from "./config.js";

// Country data sources
const COUNTRY_SOURCES = {
    fr: { name: "France", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/fr_asp_v2.txt" },
    it: { name: "Italy", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/it_asp_v2.txt" },
    ch: { name: "Switzerland", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/ch_asp_v2.txt" },
    de: { name: "Germany", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/de_asp_v2.txt" },
    es: { name: "Spain", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/es_asp_v2.txt" },
    at: { name: "Austria", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/at_asp_v2.txt" },
    be: { name: "Belgium", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/be_asp_v2.txt" },
    nl: { name: "Netherlands", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/nl_asp_v2.txt" },
    pt: { name: "Portugal", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/pt_asp_v2.txt" },
    gb: { name: "United Kingdom", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/gb_asp_v2.txt" },
    ie: { name: "Ireland", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/ie_asp_v2.txt" },
    dk: { name: "Denmark", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/dk_asp_v2.txt" },
    se: { name: "Sweden", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/se_asp_v2.txt" },
    no: { name: "Norway", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/no_asp_v2.txt" },
    fi: { name: "Finland", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/fi_asp_v2.txt" },
    pl: { name: "Poland", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/pl_asp_v2.txt" },
    cz: { name: "Czech Republic", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/cz_asp_v2.txt" },
    sk: { name: "Slovakia", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/sk_asp_v2.txt" },
    hu: { name: "Hungary", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/hu_asp_v2.txt" },
    ro: { name: "Romania", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/ro_asp_v2.txt" },
    bg: { name: "Bulgaria", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/bg_asp_v2.txt" },
    gr: { name: "Greece", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/gr_asp_v2.txt" },
    hr: { name: "Croatia", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/hr_asp_v2.txt" },
    si: { name: "Slovenia", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/si_asp_v2.txt" },
    lt: { name: "Lithuania", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/lt_asp_v2.txt" },
    lv: { name: "Latvia", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/lv_asp_v2.txt" },
    ee: { name: "Estonia", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/ee_asp_v2.txt" },
    lu: { name: "Luxembourg", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/lu_asp_v2.txt" },
    mt: { name: "Malta", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/mt_asp_v2.txt" },
    cy: { name: "Cyprus", url: "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/cy_asp_v2.txt" }
};

const PROXY_URL = 'https://edl-proxy.gabriel-briffe.workers.dev/?url=';

/**
 * Progress callback interface
 * @typedef {Object} ProgressCallback
 * @property {Function} onProgress - Called with (current, total, status)
 * @property {Function} onStatus - Called with status message
 */

/**
 * Downloads and processes airspace data for selected countries
 * @param {Array<string>} selectedCountries - Array of country codes
 * @param {ProgressCallback} callbacks - Progress and status callbacks
 * @returns {Promise<Object>} Combined GeoJSON data
 */
export async function importSelectedCountries(selectedCountries, callbacks = {}) {
    console.log('[AirspaceProcessor] Starting import for countries:', selectedCountries);
    
    if (selectedCountries.length === 0) {
        throw new Error('No countries selected for import');
    }
    
    const { onProgress = () => {}, onStatus = () => {} } = callbacks;
    
    // Initialize combined GeoJSON
    const combinedGeoJSON = {
        type: "FeatureCollection",
        features: []
    };
    
    let processedCount = 0;
    const totalCount = selectedCountries.length;
    
    onStatus('Starting airspace import...');
    onProgress(0, totalCount, 'Initializing...');
    
    // Process each country
    for (const countryCode of selectedCountries) {
        try {
            onStatus(`Processing ${COUNTRY_SOURCES[countryCode].name}...`);
            
            const countryData = await downloadCountryData(countryCode, onStatus);
            
            if (countryData && countryData.features && countryData.features.length > 0) {
                combinedGeoJSON.features.push(...countryData.features);
                console.log(`[AirspaceProcessor] Added ${countryData.features.length} features from ${COUNTRY_SOURCES[countryCode].name}`);
            } else {
                console.warn(`[AirspaceProcessor] No features found for ${COUNTRY_SOURCES[countryCode].name}`);
            }
            
            processedCount++;
            onProgress(processedCount, totalCount, `Processed ${COUNTRY_SOURCES[countryCode].name}`);
            
        } catch (error) {
            console.error(`[AirspaceProcessor] Error processing ${countryCode}:`, error);
            onStatus(`Warning: Failed to process ${COUNTRY_SOURCES[countryCode].name}: ${error.message}`);
            
            processedCount++;
            onProgress(processedCount, totalCount, `Skipped ${COUNTRY_SOURCES[countryCode].name} (error)`);
        }
    }
    
    if (combinedGeoJSON.features.length === 0) {
        throw new Error('No airspace features were successfully imported from any country');
    }
    
    onStatus('Saving to cache...');
    
    // Save combined data to cache
    await saveToCache(combinedGeoJSON);
    
    onStatus(`Successfully imported ${combinedGeoJSON.features.length} airspace features from ${processedCount} countries`);
    onProgress(totalCount, totalCount, 'Import complete');
    
    console.log(`[AirspaceProcessor] Import complete: ${combinedGeoJSON.features.length} total features`);
    
    return combinedGeoJSON;
}

/**
 * Downloads and processes airspace data for a specific country
 * @param {string} countryCode - Country code (e.g., 'fr', 'it')
 * @param {Function} onStatus - Status callback
 * @returns {Promise<Object>} GeoJSON data for the country
 */
async function downloadCountryData(countryCode, onStatus = () => {}) {
    const source = COUNTRY_SOURCES[countryCode];
    if (!source) {
        throw new Error(`Unknown country code: ${countryCode}`);
    }
    
    console.log(`[AirspaceProcessor] Downloading ${source.name} from ${source.url}`);
    
    // Download OpenAir file using proxy
    const proxyUrl = `${PROXY_URL}${encodeURIComponent(source.url)}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
        throw new Error(`Failed to download ${source.name}: ${response.status} ${response.statusText}`);
    }
    
    // Get OpenAir text content
    const openairContent = await response.text();
    
    if (!openairContent || openairContent.trim().length === 0) {
        throw new Error(`Empty response from ${source.name}`);
    }
    
    onStatus(`Converting ${source.name} to GeoJSON...`);
    
    // Process OpenAir to GeoJSON using processOpenAip
    let geoJSON;
    try {
        geoJSON = processOpenAip(openairContent);
    } catch (error) {
        console.error(`[AirspaceProcessor] Error processing OpenAir data for ${source.name}:`, error);
        throw new Error(`Failed to process OpenAir data for ${source.name}: ${error.message}`);
    }
    
    if (!geoJSON || !geoJSON.features) {
        throw new Error(`Invalid GeoJSON generated for ${source.name}`);
    }
    
    // Add country metadata to each feature
    geoJSON.features.forEach(feature => {
        if (!feature.properties) {
            feature.properties = {};
        }
        feature.properties.country = countryCode;
        feature.properties.countryName = source.name;
    });
    
    console.log(`[AirspaceProcessor] Successfully processed ${geoJSON.features.length} features from ${source.name}`);
    
    return geoJSON;
}

/**
 * Saves the combined GeoJSON to cache as airspace.geojson
 * @param {Object} geoJSON - The GeoJSON data to save
 * @returns {Promise<void>}
 */
async function saveToCache(geoJSON) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const airspaceCacheUrl = `${BASE_PATH}/airspace.geojson`;
        
        // Create a Response object with the GeoJSON data
        const response = new Response(JSON.stringify(geoJSON), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
        
        // Store in cache
        await cache.put(airspaceCacheUrl, response);
        
        console.log(`[AirspaceProcessor] Saved ${geoJSON.features.length} features to cache as ${airspaceCacheUrl}`);
        
    } catch (error) {
        console.error('[AirspaceProcessor] Error saving to cache:', error);
        throw new Error(`Failed to save airspace data to cache: ${error.message}`);
    }
}

/**
 * Clears the cached airspace data
 * @returns {Promise<boolean>} True if data was cleared successfully
 */
export async function clearAirspaceCache() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const airspaceCacheUrl = `${BASE_PATH}/airspace.geojson`;
        
        const deleted = await cache.delete(airspaceCacheUrl);
        
        if (deleted) {
            console.log('[AirspaceProcessor] Airspace cache cleared successfully');
        } else {
            console.log('[AirspaceProcessor] No airspace cache found to clear');
        }
        
        return true;
        
    } catch (error) {
        console.error('[AirspaceProcessor] Error clearing airspace cache:', error);
        throw new Error(`Failed to clear airspace cache: ${error.message}`);
    }
}

/**
 * Checks if airspace data exists in cache
 * @returns {Promise<boolean>} True if cached data exists
 */
export async function hasAirspaceCache() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const airspaceCacheUrl = `${BASE_PATH}/airspace.geojson`;
        
        const response = await cache.match(airspaceCacheUrl);
        return !!response;
        
    } catch (error) {
        console.error('[AirspaceProcessor] Error checking airspace cache:', error);
        return false;
    }
}

/**
 * Gets the list of available countries
 * @returns {Array<Object>} Array of {code, name} objects
 */
export function getAvailableCountries() {
    return Object.entries(COUNTRY_SOURCES).map(([code, source]) => ({
        code,
        name: source.name
    }));
} 