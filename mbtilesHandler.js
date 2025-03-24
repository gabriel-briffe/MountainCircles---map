/**
 * MBTiles Handler for MountainCircles Map
 * Handles loading, processing, and caching of MBTiles
 */

import { getBasePath } from './utils.js';
// At runtime, we'll use the buildTileUrl function if available, otherwise fall back to a local implementation
let buildTileUrl;

// Local implementation of buildTileUrl in case we can't import it directly
// to avoid circular imports
function createTileUrl(z, x, y) {
    const basePath = getBasePath();
    
    // Ensure consistent URL format for tile paths
    // This helps with caching by ensuring all references to the same tile use the same URL
    let url = `${basePath}/tiles/${z}/${x}/${y}.png`;
    
    // Apply additional normalization to avoid common path problems
    // 1. Remove any double slashes (except in protocol)
    url = url.replace(/([^:])\/\//g, '$1/');
    
    // 2. Ensure no 'index.html' in the path
    url = url.replace(/\/index\.html\//, '/');
    
    // 3. Add domain if it's a relative path and we're in a browser
    if (url.startsWith('.') && typeof window !== 'undefined') {
        url = `${window.location.origin}${url.substring(1)}`;
    }
    
    return url;
}

// Set our tile URL builder
try {
    // We'll try to import this at runtime to avoid circular references
    // If it fails, we'll use our local implementation
    buildTileUrl = createTileUrl;
} catch (error) {
    console.log('[DEBUG] Using local implementation of buildTileUrl');
    buildTileUrl = createTileUrl;
}

class MBTilesHandler {
    constructor() {
        this.db = null;
        this.isLoading = false;
        this.isLoaded = false;
        this.metadata = null;
        this.baseUrl = getBasePath();
        this.mbtilesPath = `${this.baseUrl}/hillshaded_alps.mbtiles`;
        console.log(`[DEBUG] MBTiles path set to: ${this.mbtilesPath}`);
        this.extractionProgress = 0;
        this.totalTiles = 0;
        this.processedTiles = 0;
        this.SQL = null;
    }

    /**
     * Initialize the MBTiles handler
     * @param {Function} progressCallback - Callback for download progress updates
     * @returns {Promise<boolean>} Whether initialization was successful
     */
    async initialize(progressCallback) {
        if (this.isLoading) {
            console.log('[DEBUG] MBTiles handler is already loading');
            return false;
        }
        
        if (this.isLoaded && this.db) {
            console.log('[DEBUG] MBTiles handler is already initialized');
            return true;
        }
        
        this.isLoading = true;
        
        try {
            console.log(`[DEBUG] Initializing MBTiles handler, path: ${this.mbtilesPath}`);
            
            // Report download starting
            if (typeof progressCallback === 'function') {
                progressCallback(0, 0, 'Downloading map data...');
            }
            
            // Fetch the MBTiles file
            const response = await fetch(this.mbtilesPath);
            if (!response.ok) {
                console.error(`[DEBUG] Failed to fetch MBTiles file: ${response.status} ${response.statusText}`);
                return false;
            }
            
            const contentLength = response.headers.get('Content-Length');
            const totalSize = contentLength ? parseInt(contentLength) : 0;
            console.log(`[DEBUG] MBTiles file size: ${totalSize ? (totalSize / (1024 * 1024)).toFixed(2) + ' MB' : 'unknown'}`);
            
            // Get the file as an array buffer with progress
            const reader = response.body.getReader();
            let receivedLength = 0;
            const chunks = [];
            
            while(true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }
                
                chunks.push(value);
                receivedLength += value.length;
                
                // Report download progress
                if (typeof progressCallback === 'function' && totalSize > 0) {
                    const progress = receivedLength / totalSize;
                    const mbReceived = (receivedLength / (1024 * 1024)).toFixed(2);
                    const mbTotal = (totalSize / (1024 * 1024)).toFixed(2);
                    progressCallback(progress, `${mbReceived}MB`, `${mbTotal}MB`, 'Downloading map data...');
                }
            }
            
            // Concatenate chunks into a single Uint8Array
            const allChunks = new Uint8Array(receivedLength);
            let position = 0;
            for (const chunk of chunks) {
                allChunks.set(chunk, position);
                position += chunk.length;
            }
            
            // Convert to ArrayBuffer
            const arrayBuffer = allChunks.buffer;
            console.log(`[DEBUG] MBTiles file loaded into memory, size: ${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB`);
            
            // Report download complete
            if (typeof progressCallback === 'function') {
                progressCallback(1, (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2) + 'MB', (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2) + 'MB', 'Download complete, initializing database...');
            }
            
            // Initialize SQL.js with the downloaded wasm file
            if (!this.SQL) {
                console.log('[DEBUG] Initializing SQL.js');
                // Check if window.initSqlJs is defined, otherwise try to load it
                if (typeof initSqlJs === 'undefined') {
                    console.log('[DEBUG] initSqlJs is not defined, attempting to use window.initSqlJs');
                    if (typeof window.initSqlJs === 'function') {
                        this.SQL = await window.initSqlJs({ 
                            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` 
                        });
                    } else {
                        console.error('[DEBUG] SQL.js initialization function not found');
                        throw new Error('SQL.js is not loaded. Please ensure sql-wasm.js is included in the page.');
                    }
                } else {
                    this.SQL = await initSqlJs({ 
                        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` 
                    });
                }
                console.log('[DEBUG] SQL.js initialized successfully');
            }
            
            // Create a database from the MBTiles file
            console.log('[DEBUG] Creating database from MBTiles file');
            this.db = new this.SQL.Database(new Uint8Array(arrayBuffer));
            console.log('[DEBUG] Database created successfully');
            
            // Check if this is a valid MBTiles file by querying metadata
            try {
                const metadataStmt = this.db.prepare("SELECT name, value FROM metadata WHERE name IN ('name', 'format', 'bounds')");
                let metadata = {};
                while (metadataStmt.step()) {
                    const row = metadataStmt.getAsObject();
                    metadata[row.name] = row.value;
                }
                metadataStmt.free();
                
                if (!metadata.format || !metadata.name) {
                    console.error('[DEBUG] Invalid MBTiles file: missing required metadata');
                    this.db.close();
                    this.db = null;
                    return false;
                }
                
                console.log(`[DEBUG] Valid MBTiles file found: ${metadata.name}, format: ${metadata.format}, bounds: ${metadata.bounds}`);
            } catch (metadataError) {
                console.error(`[DEBUG] Error checking MBTiles metadata: ${metadataError.message}`);
                this.db.close();
                this.db = null;
                return false;
            }
            
            // Get tile bounds
            try {
                const minZoomStmt = this.db.prepare("SELECT MIN(zoom_level) as min_zoom FROM tiles");
                minZoomStmt.step();
                this.minZoom = minZoomStmt.getAsObject().min_zoom;
                minZoomStmt.free();
                
                const maxZoomStmt = this.db.prepare("SELECT MAX(zoom_level) as max_zoom FROM tiles");
                maxZoomStmt.step();
                this.maxZoom = maxZoomStmt.getAsObject().max_zoom;
                maxZoomStmt.free();
                
                console.log(`[DEBUG] MBTiles zoom levels: min=${this.minZoom}, max=${this.maxZoom}`);
                
                // Count total tiles
                const countStmt = this.db.prepare("SELECT COUNT(*) as count FROM tiles");
                countStmt.step();
                this.totalTiles = countStmt.getAsObject().count;
                countStmt.free();
                
                console.log(`[DEBUG] Total tiles in MBTiles: ${this.totalTiles}`);
                
                // Report database initialization complete
                if (typeof progressCallback === 'function') {
                    progressCallback(1, this.totalTiles, this.totalTiles, 'Database initialized, ready for extraction');
                }
            } catch (boundsError) {
                console.error(`[DEBUG] Error getting tile bounds: ${boundsError.message}`);
                this.db.close();
                this.db = null;
                return false;
            }
            
            this.isLoading = false;
            this.isLoaded = true;
            return true;
        } catch (error) {
            console.error(`[DEBUG] Error initializing MBTiles handler: ${error.message}`);
            if (this.db) {
                this.db.close();
                this.db = null;
            }
            this.isLoading = false;
            return false;
        }
    }

    /**
     * Load metadata from the MBTiles file
     * @returns {Promise<Object>} Metadata object
     */
    async loadMetadata() {
        if (!this.db) {
            throw new Error("Database not initialized");
        }

        const metadata = {};
        const results = this.db.exec("SELECT name, value FROM metadata");
        
        if (results.length > 0 && results[0].values) {
            for (const [name, value] of results[0].values) {
                metadata[name] = value;
            }
        }

        return metadata;
    }

    /**
     * Get a tile from the MBTiles database
     * @param {number} z - Zoom level
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Promise<Blob|null>} Tile data as a Blob, or null if not found
     */
    async getTile(z, x, y) {
        if (!this.db) {
            await this.initialize();
        }

        // MBTiles uses TMS coordinates (origin bottom left), 
        // but web maps use XYZ coordinates (origin top left)
        // We need to flip the y coordinate
        const flippedY = (1 << z) - 1 - y;

        try {
            // Query the tile from the database
            const results = this.db.exec({
                sql: "SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?",
                bind: [z, x, flippedY]
            });

            // If no results, return null
            if (!results.length || !results[0].values.length) {
                return null;
            }

            // Get the tile data
            const tileData = results[0].values[0][0];
            
            // Figure out the content type
            let contentType = 'image/png';
            if (this.metadata && this.metadata.format) {
                if (this.metadata.format === 'jpg' || this.metadata.format === 'jpeg') {
                    contentType = 'image/jpeg';
                } else if (this.metadata.format === 'pbf' || this.metadata.format === 'mvt') {
                    contentType = 'application/x-protobuf';
                }
            }

            // Convert to Blob
            return new Blob([tileData], { type: contentType });
        } catch (error) {
            console.error(`Error getting tile z=${z}, x=${x}, y=${y}:`, error);
            return null;
        }
    }

    /**
     * Extract all tiles from the MBTiles file and cache them
     * @param {Function} progressCallback - Callback for progress updates
     * @returns {Promise<void>}
     */
    async extractAndCacheTiles(progressCallback) {
        if (!this.db) {
            console.log("[DEBUG] Database not initialized, initializing now");
            await this.initialize();
        }

        try {
            // Count total tiles
            console.log("[DEBUG] Counting total tiles in database");
            const countResult = this.db.exec("SELECT COUNT(*) FROM tiles");
            this.totalTiles = countResult[0].values[0][0];
            this.processedTiles = 0;
            console.log(`[DEBUG] Total tiles in database: ${this.totalTiles}`);
            
            // Open the cache
            console.log("[DEBUG] Opening mbtiles-cache");
            const cache = await caches.open('mbtiles-cache');
            
            // Get all tiles
            console.log("[DEBUG] Querying all tiles from database");
            const tileResults = this.db.exec("SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles");
            
            // Process in batches to avoid blocking the UI
            const batchSize = 100;
            const totalBatches = Math.ceil(this.totalTiles / batchSize);
            console.log(`[DEBUG] Processing ${totalBatches} batches of ${batchSize} tiles each`);
            
            if (!tileResults.length || !tileResults[0].values) {
                throw new Error("[DEBUG] No tiles found in MBTiles file");
            }
            
            for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                const start = batchIndex * batchSize;
                const end = Math.min(start + batchSize, this.totalTiles);
                const batch = tileResults[0].values.slice(start, end);
                console.log(`[DEBUG] Processing batch ${batchIndex + 1}/${totalBatches} (tiles ${start}-${end-1})`);
                
                await Promise.all(batch.map(async ([zoom_level, tile_column, tile_row, tile_data]) => {
                    // MBTiles uses TMS coordinates, flip y to XYZ
                    const y = (1 << zoom_level) - 1 - tile_row;
                    
                    // Create URL for this tile using our consistent URL builder
                    const url = buildTileUrl(zoom_level, tile_column, y);
                    
                    // Determine content type
                    let contentType = 'image/png';
                    if (this.metadata && this.metadata.format) {
                        if (this.metadata.format === 'jpg' || this.metadata.format === 'jpeg') {
                            contentType = 'image/jpeg';
                        } else if (this.metadata.format === 'pbf' || this.metadata.format === 'mvt') {
                            contentType = 'application/x-protobuf';
                        }
                    }
                    
                    // Create response
                    const response = new Response(new Blob([tile_data], { type: contentType }), {
                        status: 200,
                        headers: { 'Content-Type': contentType }
                    });
                    
                    // Cache the response
                    await cache.put(url, response);
                    
                    // Update progress
                    this.processedTiles++;
                    this.extractionProgress = this.processedTiles / this.totalTiles;
                    
                    if (typeof progressCallback === 'function' && this.processedTiles % 50 === 0) {
                        progressCallback(this.extractionProgress, this.processedTiles, this.totalTiles);
                    }
                }));
                
                // Report batch progress
                if (typeof progressCallback === 'function') {
                    console.log(`[DEBUG] Batch ${batchIndex + 1} complete, progress: ${Math.floor(this.extractionProgress * 100)}%`);
                    progressCallback(this.extractionProgress, this.processedTiles, this.totalTiles);
                }
            }
            
            console.log(`[DEBUG] Extracted and cached ${this.processedTiles} tiles from MBTiles`);
            return true;
        } catch (error) {
            console.error("[DEBUG] Error extracting tiles:", error);
            return false;
        }
    }

    /**
     * Close the database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isLoaded = false;
        }
    }
}

// Create and export a singleton instance of the handler
const mbtilesHandler = new MBTilesHandler();
export default mbtilesHandler; 