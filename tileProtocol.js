/**
 * Custom Tile Protocol for MountainCircles Map
 * Unified protocol that checks regional IndexedDB first, then falls back to OSM
 */

import { unifiedTileStorage } from './unifiedTileStorage.js';

// OSM tile server configuration
const OSM_TILE_SERVERS = [
    'https://tile.openstreetmap.org',
    // Add more OSM servers for load balancing if needed
];

/**
 * Custom tile protocol handler
 * Protocol format: custom://tiles/{z}/{x}/{y}
 */
async function customTileProtocol(params) {
    try {
        // Extract tile coordinates from URL
        const url = new URL(params.url);
        const pathParts = url.pathname.split('/');
        
        // Expected format: custom://tiles/{z}/{x}/{y}
        // URL parts: hostname = "tiles", pathname = "/{z}/{x}/{y}"
        // pathParts will be ['', 'z', 'x', 'y'] for custom://tiles/{z}/{x}/{y}
        if (url.hostname !== 'tiles' || pathParts.length < 4) {
            console.error(`[TileProtocol] Invalid URL format - expected hostname 'tiles' and 4+ path parts, got hostname: '${url.hostname}', pathParts:`, pathParts);
            throw new Error('Invalid tile URL format');
        }

        const z = parseInt(pathParts[1], 10);
        const x = parseInt(pathParts[2], 10);
        const y = parseInt(pathParts[3].split('.')[0], 10); // Remove file extension if present

        if (isNaN(z) || isNaN(x) || isNaN(y)) {
            throw new Error('Invalid tile coordinates');
        }

        console.log(`[TileProtocol] Requesting tile: ${z}/${x}/${y}`);

        // First, try to get tile from regional IndexedDB
        const cachedTile = await unifiedTileStorage.getRegionalTile(z, x, y);
        
        if (cachedTile) {
            console.log(`[TileProtocol] Serving tile from regional cache: ${z}/${x}/${y} (region: ${cachedTile.region})`);
            
            // Return cached tile
            return {
                data: cachedTile.data,
                cacheControl: 'public, max-age=31536000', // 1 year cache
                expires: new Date(Date.now() + 31536000000).toUTCString(),
                contentType: cachedTile.contentType || 'image/png'
            };
        }

        // If not found in cache, fetch from OSM
        console.log(`[TileProtocol] Tile not in cache, fetching from OSM: ${z}/${x}/${y}`);
        
        // Select OSM server (simple round-robin or just use first)
        const osmServer = OSM_TILE_SERVERS[0];
        const osmUrl = `${osmServer}/${z}/${x}/${y}.png`;
        
        // Fetch from OSM
        const response = await fetch(osmUrl, {
            headers: {
                'User-Agent': 'MountainCircles Map (https://gabriel-briffe.github.io/MountainCircles---map/)',
                'Referer': 'https://gabriel-briffe.github.io/'
            }
        });

        if (!response.ok) {
            throw new Error(`OSM fetch failed: ${response.status} ${response.statusText}`);
        }

        const tileData = await response.arrayBuffer();
        
        console.log(`[TileProtocol] Serving tile from OSM: ${z}/${x}/${y}`);
        
        // Return OSM tile
        return {
            data: tileData,
            cacheControl: 'public, max-age=86400', // 1 day cache for OSM tiles
            expires: new Date(Date.now() + 86400000).toUTCString(),
            contentType: 'image/png'
        };

        // Optional: Cache OSM tile for future use (uncomment if desired)
        // This would store OSM tiles in the regional cache for offline use
        /*
        try {
            await unifiedTileStorage.storeRegionalTile(
                z, x, y, 
                tileData, 
                'osm-fallback', 
                'image/png'
            );
            console.log(`[TileProtocol] Cached OSM tile for future use: ${z}/${x}/${y}`);
        } catch (cacheError) {
            console.warn(`[TileProtocol] Failed to cache OSM tile: ${cacheError.message}`);
        }
        */

    } catch (error) {
        console.error(`[TileProtocol] Error handling tile request:`, error);
        throw error;
    }
}

/**
 * EDL tile protocol handler
 * Protocol format: edl://tiles/{forecastDate}/{z}/{x}/{y}
 */
async function edlTileProtocol(params) {
    try {
        // Extract tile coordinates from URL
        const url = new URL(params.url);
        const pathParts = url.pathname.split('/');
        
        // Expected format: edl://tiles/{forecastDate}/{z}/{x}/{y}
        // URL parts: hostname = "tiles", pathname = "/{forecastDate}/{z}/{x}/{y}"
        // pathParts will be ['', 'forecastDate', 'z', 'x', 'y'] for edl://tiles/{forecastDate}/{z}/{x}/{y}
        if (url.hostname !== 'tiles' || pathParts.length < 5) {
            throw new Error('Invalid EDL tile URL format');
        }

        const forecastDate = pathParts[1];
        const z = parseInt(pathParts[2], 10);
        const x = parseInt(pathParts[3], 10);
        const y = parseInt(pathParts[4].split('.')[0], 10); // Remove file extension

        if (isNaN(z) || isNaN(x) || isNaN(y)) {
            throw new Error('Invalid EDL tile coordinates');
        }

        console.log(`[EDLProtocol] Requesting EDL tile: ${forecastDate}/${z}/${x}/${y}`);

        // Get current layer info to construct the correct tile ID
        // We need to access the current layer parameters (date, hour, pressure)
        let edlTileSetId = forecastDate;
        
        // Try to get current layer info from window global if available
        if (window.currentEDLLayerInfo) {
            const layerInfo = window.currentEDLLayerInfo;
            edlTileSetId = `${forecastDate}_${layerInfo.date}_${layerInfo.hour}_${layerInfo.pressure}`;
            console.log(`[EDLProtocol] Using specific EDL tile set ID: ${edlTileSetId}`);
        }

        // Get tile from EDL IndexedDB
        const cachedTile = await unifiedTileStorage.getEDLTile(z, x, y, edlTileSetId);
        
        if (cachedTile) {
            console.log(`[EDLProtocol] Serving EDL tile from cache: ${edlTileSetId}/${z}/${x}/${y}`);
            
            return {
                data: cachedTile.data,
                cacheControl: 'public, max-age=259200', // 3 days cache for EDL
                expires: new Date(Date.now() + 259200000).toUTCString(),
                contentType: cachedTile.contentType || 'image/png'
            };
        }

        // EDL tile not found - this is normal for empty areas
        // Return a 404-like error that MapLibre can handle gracefully without console errors
        // Using debug level logging since this is expected behavior
        if (Math.random() < 0.01) { // Only log 1% of missing tiles to avoid console spam
            console.log(`[EDLProtocol] EDL tiles not found for empty areas (this is normal): ${edlTileSetId}`);
        }
        
        // Throw a 404-style error that MapLibre handles gracefully
        const error = new Error('Tile not found');
        error.status = 404;
        throw error;

    } catch (error) {
        // Don't log 404 errors as they're expected for empty areas
        if (error.status !== 404) {
            console.error(`[EDLProtocol] Error handling EDL tile request:`, error);
        }
        throw error;
    }
}

/**
 * Register custom protocols with MapLibre
 */
export function registerTileProtocols() {
    console.log('[TileProtocol] Registering custom tile protocols...');
    
    try {
        // Register the custom tile protocol
        maplibregl.addProtocol('custom', customTileProtocol);
        console.log('[TileProtocol] Custom tile protocol registered');
        
        // Register the EDL tile protocol
        maplibregl.addProtocol('edl', edlTileProtocol);
        console.log('[TileProtocol] EDL tile protocol registered');
        
        return true;
    } catch (error) {
        console.error('[TileProtocol] Failed to register protocols:', error);
        return false;
    }
}

/**
 * Unregister custom protocols (for cleanup)
 */
export function unregisterTileProtocols() {
    console.log('[TileProtocol] Unregistering custom tile protocols...');
    
    try {
        maplibregl.removeProtocol('custom');
        maplibregl.removeProtocol('edl');
        console.log('[TileProtocol] Custom tile protocols unregistered');
        return true;
    } catch (error) {
        console.error('[TileProtocol] Failed to unregister protocols:', error);
        return false;
    }
}

/**
 * Check if protocols are registered
 */
export function areProtocolsRegistered() {
    // There's no direct way to check if a protocol is registered in MapLibre
    // We'll return true if the functions exist
    return typeof maplibregl.addProtocol === 'function' && 
           typeof maplibregl.removeProtocol === 'function';
}

/**
 * Protocol configuration for different tile types
 */
export const PROTOCOL_CONFIG = {
    regional: {
        protocol: 'custom',
        baseUrl: 'custom://tiles',
        tileUrlTemplate: 'custom://tiles/{z}/{x}/{y}',
        attribution: 'Map data © OpenStreetMap contributors + Regional topographic data'
    },
    edl: {
        protocol: 'edl', 
        baseUrl: 'edl://tiles',
        tileUrlTemplate: 'edl://tiles/{forecastDate}/{z}/{x}/{y}',
        attribution: 'Weather data from EDL'
    }
}; 