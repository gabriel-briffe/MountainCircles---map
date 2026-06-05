/**
 * Custom Tile Protocol for MountainCircles Map
 * Unified protocol that checks regional IndexedDB first, then falls back to OSM
 */

import { unifiedTileStorage } from './unifiedTileStorage.js';
import { MAPTERHORN_TILE_SETTINGS, TILE_CACHE_MAX_AGE_SECONDS } from './config.js';

// OSM tile server configuration
const OSM_TILE_SERVERS = [
    'https://tile.openstreetmap.org',
];

const UNLIMITED_CACHE_CONTROL = `public, max-age=${TILE_CACHE_MAX_AGE_SECONDS}`;
const UNLIMITED_CACHE_EXPIRES = new Date(Date.now() + TILE_CACHE_MAX_AGE_SECONDS * 1000).toUTCString();

function buildTileResponse(tileData, contentType) {
    return {
        data: tileData,
        cacheControl: UNLIMITED_CACHE_CONTROL,
        expires: UNLIMITED_CACHE_EXPIRES,
        contentType
    };
}

function parseTileCoordinates(pathParts) {
    const z = parseInt(pathParts[1], 10);
    const x = parseInt(pathParts[2], 10);
    const y = parseInt(pathParts[3].split('.')[0], 10);

    if (isNaN(z) || isNaN(x) || isNaN(y)) {
        throw new Error('Invalid tile coordinates');
    }

    return { z, x, y };
}

/**
 * Custom tile protocol handler
 * Protocol format: custom://tiles/{z}/{x}/{y}
 */
async function customTileProtocol(params) {
    try {
        const url = new URL(params.url);
        const pathParts = url.pathname.split('/');

        if (url.hostname !== 'tiles' || pathParts.length < 4) {
            console.error(`[TileProtocol] Invalid URL format - expected hostname 'tiles' and 4+ path parts, got hostname: '${url.hostname}', pathParts:`, pathParts);
            throw new Error('Invalid tile URL format');
        }

        const { z, x, y } = parseTileCoordinates(pathParts);

        console.log(`[TileProtocol] Requesting tile: ${z}/${x}/${y}`);

        const cachedTile = await unifiedTileStorage.getRegionalTile(z, x, y);

        if (cachedTile) {
            console.log(`[TileProtocol] Serving tile from cache: ${z}/${x}/${y} (region: ${cachedTile.region})`);
            return buildTileResponse(
                cachedTile.data,
                cachedTile.contentType || 'image/png'
            );
        }

        console.log(`[TileProtocol] Tile not in cache, fetching from OSM: ${z}/${x}/${y}`);

        const osmUrl = `${OSM_TILE_SERVERS[0]}/${z}/${x}/${y}.png`;
        const response = await fetch(osmUrl, {
            headers: {
                'User-Agent': 'MountainCircles Map (https://map.mountain-circles.org/)',
                'Referer': 'https://map.mountain-circles.org/'
            }
        });

        if (!response.ok) {
            throw new Error(`OSM fetch failed: ${response.status} ${response.statusText}`);
        }

        const tileData = await response.arrayBuffer();

        try {
            await unifiedTileStorage.storeRegionalTile(z, x, y, tileData, 'osm', 'image/png');
            console.log(`[TileProtocol] Cached OSM tile: ${z}/${x}/${y}`);
        } catch (cacheError) {
            console.warn(`[TileProtocol] Failed to cache OSM tile: ${cacheError.message}`);
        }

        console.log(`[TileProtocol] Serving tile from OSM: ${z}/${x}/${y}`);
        return buildTileResponse(tileData, 'image/png');

    } catch (error) {
        console.error(`[TileProtocol] Error handling tile request:`, error);
        throw error;
    }
}

/**
 * Mapterhorn terrain tile protocol handler
 * Protocol format: mapterhorn://tiles/{z}/{x}/{y}
 */
async function mapterhornTileProtocol(params) {
    try {
        const url = new URL(params.url);
        const pathParts = url.pathname.split('/');

        if (url.hostname !== 'tiles' || pathParts.length < 4) {
            throw new Error('Invalid Mapterhorn tile URL format');
        }

        const { z, x, y } = parseTileCoordinates(pathParts);

        const cachedTile = await unifiedTileStorage.getMapterhornTile(z, x, y);

        if (cachedTile) {
            return buildTileResponse(
                cachedTile.data,
                cachedTile.contentType || 'image/webp'
            );
        }

        const mapterhornUrl = MAPTERHORN_TILE_SETTINGS.tileUrl
            .replace('{z}', z)
            .replace('{x}', x)
            .replace('{y}', y);

        const response = await fetch(mapterhornUrl);

        if (!response.ok) {
            const error = new Error(`Mapterhorn fetch failed: ${response.status} ${response.statusText}`);
            error.status = response.status;
            throw error;
        }

        const tileData = await response.arrayBuffer();

        try {
            await unifiedTileStorage.storeMapterhornTile(z, x, y, tileData, 'image/webp');
        } catch (cacheError) {
            console.warn(`[MapterhornProtocol] Failed to cache tile: ${cacheError.message}`);
        }

        return buildTileResponse(tileData, 'image/webp');

    } catch (error) {
        if (error.status !== 404) {
            console.error(`[MapterhornProtocol] Error handling tile request:`, error);
        }
        throw error;
    }
}

/**
 * EDL tile protocol handler
 * Protocol format: edl://tiles/{forecastDate}/{z}/{x}/{y}
 */
async function edlTileProtocol(params) {
    try {
        const url = new URL(params.url);
        const pathParts = url.pathname.split('/');

        if (url.hostname !== 'tiles' || pathParts.length < 5) {
            throw new Error('Invalid EDL tile URL format');
        }

        const forecastDate = pathParts[1];
        const z = parseInt(pathParts[2], 10);
        const x = parseInt(pathParts[3], 10);
        const y = parseInt(pathParts[4].split('.')[0], 10);

        if (isNaN(z) || isNaN(x) || isNaN(y)) {
            throw new Error('Invalid EDL tile coordinates');
        }

        console.log(`[EDLProtocol] Requesting EDL tile: ${forecastDate}/${z}/${x}/${y}`);

        let edlTileSetId = forecastDate;

        if (window.currentEDLLayerInfo) {
            const layerInfo = window.currentEDLLayerInfo;
            edlTileSetId = `${forecastDate}_${layerInfo.date}_${layerInfo.hour}_${layerInfo.pressure}`;
            console.log(`[EDLProtocol] Using specific EDL tile set ID: ${edlTileSetId}`);
        }

        const cachedTile = await unifiedTileStorage.getEDLTile(z, x, y, edlTileSetId);

        if (cachedTile) {
            console.log(`[EDLProtocol] Serving EDL tile from cache: ${edlTileSetId}/${z}/${x}/${y}`);

            return {
                data: cachedTile.data,
                cacheControl: 'public, max-age=259200',
                expires: new Date(Date.now() + 259200000).toUTCString(),
                contentType: cachedTile.contentType || 'image/png'
            };
        }

        if (Math.random() < 0.01) {
            console.log(`[EDLProtocol] EDL tiles not found for empty areas (this is normal): ${edlTileSetId}`);
        }

        const error = new Error('Tile not found');
        error.status = 404;
        throw error;

    } catch (error) {
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
        maplibregl.addProtocol('custom', customTileProtocol);
        console.log('[TileProtocol] Custom tile protocol registered');

        maplibregl.addProtocol('mapterhorn', mapterhornTileProtocol);
        console.log('[TileProtocol] Mapterhorn tile protocol registered');

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
        maplibregl.removeProtocol('mapterhorn');
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
        attribution: 'Map data © OpenStreetMap contributors'
    },
    mapterhorn: {
        protocol: 'mapterhorn',
        baseUrl: 'mapterhorn://tiles',
        tileUrlTemplate: MAPTERHORN_TILE_SETTINGS.protocolTemplate,
        attribution: MAPTERHORN_TILE_SETTINGS.attribution
    },
    edl: {
        protocol: 'edl',
        baseUrl: 'edl://tiles',
        tileUrlTemplate: 'edl://tiles/{forecastDate}/{z}/{x}/{y}',
        attribution: 'Weather data from EDL'
    }
};
